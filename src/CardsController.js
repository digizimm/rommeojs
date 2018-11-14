import $ from "jquery";
import "jquery-ui-bundle";
import { RommeoConfig } from './config';

const CardsController = {};
const CC = CardsController;

if (typeof Array.prototype.reIndexOf === 'undefined') {
    Array.prototype.reIndexOf = function (rx) {
        rx = new RegExp(rx);
        let collection = [];
        for (let i=0; i<this.length; i++) {
            if (rx.test(this[i])) {
                collection.push(this[i]);
            }
        }
        return collection;
    };
}

CC.init = function(matchConfig) {
    /** Map configuration to library vars */
    CC.sequentialDelayBetweenEachCardAnimation = RommeoConfig.sequentialDelayBetweenEachCardAnimation; // ms
    CC.delayBetweenDitributions = RommeoConfig.delayBetweenDitributions; // ms
    CC.cardsTravelTime = RommeoConfig.cardsTravelTime; // ms

    CC.optimalDistanceBetweenCardsAtOpponentsHand = RommeoConfig.optimalDistanceBetweenCardsAtOpponentsHand; // px
    CC.optimalDistanceBetweenCardsAtHand = RommeoConfig.optimalDistanceBetweenCardsAtHand; // px

    CC.cardWidth = RommeoConfig.cardWidth; // px
    CC.cardHeight = RommeoConfig.cardHeight; // px

    CC.leftHandPosAdjust = RommeoConfig.leftHandPosAdjust; // px
    CC.topHandPosAdjust = RommeoConfig.topHandPosAdjust; // px
    CC.bottomHandPosAdjust = RommeoConfig.bottomHandPosAdjust; // px
    CC.rightHandPosAdjust = RommeoConfig.rightHandPosAdjust; // px

    CC.horizontalCardsPadding = RommeoConfig.horizontalCardsPadding; // px
    CC.verticalCardsPadding = RommeoConfig.verticalCardsPadding; // px

    /** Private config - dont touch from here! */
    // Make the matchconfig accessible for this library
    CC.matchConfig = matchConfig;
    // Flag for distributeCards()
    CC.allCardsHandedOut = false;
    // Callback registry for card move events
    CC.onCardMoveCbs = [];
    // Counts the distributed cards per player
    CC.finishedCardAnimations = {
        "player_hand": 0,
        "opponent_hand_left": 0,
        "opponent_hand_top": 0,
        "opponent_hand_right": 0,
    };
    // Temporarily saves card info objects for every distributed card
    CC.distributedCards = [];
    // Will hold every card info object
    CC.cardRegistry = [];
    // Semantic position infos
    CC.semanticPosInfos = [];
    CC.semanticPosCreationOrder = [];
    // Setup default semantic registry
    CC.semanticPosInfos["unused_stack"] = [];
    // Setup default card info object for each card and add it to default semantic registry
    for (let i=1; i<=matchConfig.cards; i++) {
        CC.cardRegistry[i] = {
            id: i,
            picture: null,
            pos: {top: null, left: null},
            order_pos: (i % CC.matchConfig.cardsPerPlayer === 0) ? CC.matchConfig.cardsPerPlayer : i % CC.matchConfig.cardsPerPlayer,
            semantic_pos: "unused_stack",
            revealed: false,
            z_index: (i % CC.matchConfig.cardsPerPlayer === 0) ? CC.matchConfig.cardsPerPlayer : i % CC.matchConfig.cardsPerPlayer
        };
        // Add card to default semantic registry
        CC.semanticPosInfos["unused_stack"].push(CC.cardRegistry[i]);
    }
    // Extend user object with a got-all-initial-cards flag
    for (let i=0; i<CC.matchConfig.users.length; i++) {
        CC.matchConfig.users[i].gotAllInitialCards = false;
    }
}

CC.getCardRegistry = function() {
    return CC.cardRegistry;
}

CC.distributeCards = function(cbsInfos) {
    CC.attachCbOnCardMove(cbsInfos);
    CC.distribute();
}

CC.distribute = function() {
    for (let userIdx=0; userIdx<CC.matchConfig.users.length; userIdx++) {
        // Skip if the related player already received all his cards
        if (CC.matchConfig.users[userIdx].gotAllInitialCards) {
            continue;
        }

        // Distribute all cards to the related player
        for (let cardNo=1; cardNo<=CC.matchConfig.cardsPerPlayer; cardNo++) {
            // Get card object from deck
            let card = CC.getCardFromDeck();

            // Set card sub id
            card.subId = CC.matchConfig.cardsPerPlayer-cardNo;

            // Set semantic position
            card.semantic_pos = CC.matchConfig.users[userIdx].table_pos;

            // Add card info object to semantic registry
            if (!CC.semanticPosInfos[card.semantic_pos]) {
                CC.semanticPosInfos[card.semantic_pos] = [];
                card.order_pos = CC.semanticPosInfos[card.semantic_pos].length;
            } else {
                CC.semanticPosInfos[card.semantic_pos].push(card);
                card.order_pos = CC.semanticPosInfos[card.semantic_pos].length;
            }

            // Calculate position for this card
            card.pos = CC.calculateCardPosition(card);

            // Calculate delay and set it
            let options = {delay: (userIdx * CC.delayBetweenDitributions) + (CC.sequentialDelayBetweenEachCardAnimation * parseInt(card.id))};

            // Initialize the animation
            CC.moveCardToPos(card, options);

            // Mark/save the card info object as distributed so we can work with it later on in a cb after distribution finished
            CC.distributedCards.push(card);
        }

        // Set flag that the related player received all its cards
        CC.matchConfig.users[userIdx].gotAllInitialCards = true;

        // Continue with distribution loop after short delay
        setTimeout(function(){ CC.distribute() }, CC.delayBetweenDitributions);
    }
}

/**
 * Calculates the card position based on its semantic and order position
 * @param card
 * @returns {{top: *, left: *}}
 */
CC.calculateCardPosition = function(card) {
    let top, left;

    switch(card.semantic_pos) {
        case "player_hand":
            // top position
            top = parseInt($(".gamefield").height()) - CC.cardHeight - CC.bottomHandPosAdjust;
            // left position
            left = (card.order_pos+1) * CC.distanceBetweenCardsAtHand + CC.gapToFirstHorizontalCard;
            break;
        case "opponent_hand_left":
            // top position
            top = card.order_pos * CC.distanceBetweenCardsAtOpponentsHandY + CC.gapToFirstOppVerticalCard;
            // left position
            left = CC.leftHandPosAdjust;
            break;
        case "opponent_hand_top":
            // top position
            top = CC.topHandPosAdjust;
            // left position
            left = (card.order_pos+1) * CC.distanceBetweenCardsAtOpponentsHandX + CC.gapToFirstOppHorizontalCard;
            break;
        case "opponent_hand_right":
            // top position
            top = card.order_pos * CC.distanceBetweenCardsAtOpponentsHandY + CC.gapToFirstOppVerticalCard;
            // left position
            left = parseInt($(".gamefield").width()) - CC.rightHandPosAdjust;
            break;
        case "unused_stack":
            top = parseInt($(".sorted-staple").css("top"));
            left = parseInt($(".sorted-staple").css("left"));
            break;
        default:
            break;
    }

    return {top: top, left: left};
}

CC.addFirstCardToTrayStack = function(picture) {
    // Get the card object for the very first card on the deck
    let deckCard = CC.getCardFromDeck();
    deckCard.semantic_move = "deck_to_tray_stack";
    deckCard.picture = picture;
    let trayStackPos = {top: $(".drop-staple").css("top"), left: $(".drop-staple").css("left")};
    deckCard.pos = trayStackPos;
    CC.moveCard(deckCard, {semantic_pos: "tray_stack", new_order: [1]});

    // Update semantic position for new tray stack card
    CC.cardRegistry[deckCard.id].semantic_pos = "tray_stack";

    CC.attachCbOnCardMove({
        on: "deck_to_tray_stack",
        condition: "cardid:" + deckCard.id,
        usage: "one_time",
        handler: CC.onFirstDeckToTrayStackCard
    });
}

CC.onFirstDeckToTrayStackCard = function(card) {
    // Animates the flip
    $("#card-" + card.id).find(".card").addClass("is-flipped");
    // Adds click event to the new tray stack card
    $('#card-' + card.id).click(function() {
        alert("picked");
    });

    /** Has to be exluded from here since its not related to this function... */
    // Makes the very top deck and tray stack card shine
    $("#card-" + card.id).find(".card").addClass("highlight-card");
    card = CC.getCardFromDeck();
    $("#card-" + card.id).find(".card").addClass("highlight-card");
}

CC.attachCbOnCardMove = function(cbsInfos) {
    cbsInfos = Array.isArray(cbsInfos) ? cbsInfos : [cbsInfos];
    CC.onCardMoveCbs = CC.onCardMoveCbs.concat(cbsInfos);
}

CC.getCardFromDeck = function() {
    for (let i=1; i<CC.cardRegistry.length; i++) {
        if (CC.cardRegistry[i].semantic_pos === "unused_stack") {
            return CC.cardRegistry[i];
        }
    }
}

CC.setCoordinatesFor = function(card, settings) {

    // Get ids of all tray area stacks
    let trayStackAreaIds = Object.keys(CC.semanticPosInfos).reIndexOf(/tray_area_stack/);

    // Check if related tray area stack exists and set flag
    let trayStackAreaExists = false;

    if (CC.semanticPosInfos[settings.semantic_pos]) {
        trayStackAreaExists = true;
    }

    console.log("------------ setCoordinatesFor -------------");

    // In case there is no tray area stack yet
    if (!trayStackAreaExists && trayStackAreaIds.length === 0) {

        // Get the current position and size of the tray area
        let trayAreaPos = {left: parseInt($(".tray-area").css("left")), top: parseInt($(".tray-area").css("top"))};
        let trayAreaSize = {width: $(".tray-area").width(), height: $(".tray-area").height()};
        console.log(trayAreaSize);
        console.log(trayAreaPos);
        // Now calculate the position for the card by respecting the size of a card and the related cards within this new tray area stack
        let top = (trayAreaSize.height / 2) - (CC.cardHeight / 2) + trayAreaPos.top;
        let left = (trayAreaSize.width / 2) - (CC.cardWidth / 2) + trayAreaPos.left - ((settings.new_order.indexOf(card.id))*25) / 2;

        CC.cardRegistry[card.id].pos = {top: top, left: left};

        return {top: top, left: left};

    // In case the tray area stack does not exist, but atleast one other tray area stack exists.
    } else if (!trayStackAreaExists && trayStackAreaIds.length > 0) {
        console.log("triggered");
        // Get very last card of the last tray stack area
        console.log("--------------------- semantic pos infos -------------------");
        console.log(CC.semanticPosInfos);
        let veryLastCard = CC.semanticPosInfos[ trayStackAreaIds[trayStackAreaIds.length-1] ][CC.semanticPosInfos[ trayStackAreaIds[trayStackAreaIds.length-1] ].length-1];

        // In case card still fits into the row of the previous tray area stack
        console.log(veryLastCard);
        console.log((parseInt($("#card-" + veryLastCard.id).css("left")) + " + " +(2*CC.cardWidth) + " + " + 70));
        console.log(veryLastCard.pos);

        let cardsInRows = CC.generateTrayAreaRegistry();
        let idx = CC.generateUniqueHashFromNumber(Math.abs(veryLastCard.pos.top + 145));

        let count = 0;
        console.log(veryLastCard.semantic_pos + " and " + settings.semantic_pos);
        for (let i=1; i<CC.cardRegistry.length; i++) {
            if (CC.cardRegistry[i].semantic_pos === veryLastCard.semantic_pos) {
                count++;
            }
        }

        count += settings.new_order.length-1;

        console.log(((2*CC.cardWidth) + 70 + (count-1)*25) + "<=" + (parseInt($(".tray-area").width())));

        console.log((2*CC.cardWidth) + 70 + (count-1)*25);
        console.log((2*CC.cardWidth) + " + 70 + " + (count-1)*25);

        if ((2*CC.cardWidth) + 70 + (count-1)*25 <= parseInt($(".tray-area").width())) {
            console.log("x will be: " + (veryLastCard.pos.left + CC.cardWidth + 70));
            console.log("y will be: " + (veryLastCard.pos.top));

            let left = veryLastCard.pos.left + CC.cardWidth + 70;
            let top = veryLastCard.pos.top;

            CC.cardRegistry[card.id].pos = {top: top, left: left};

            return {top: top, left: left};

        // Seems not fit in this last row any more, so we begin a new row and trigger resizing for all tray area stacks
        } else {

            // If there is no tray area stack in this row, we position this card right into the middle
            if (!cardsInRows[idx]) {
                console.log("triggered 2");
                let trayAreaPos = {left: parseInt($(".tray-area").css("left")), top: parseInt($(".tray-area").css("top"))};
                let trayAreaSize = {width: $(".tray-area").width(), height: $(".tray-area").height()};
                let top = (trayAreaSize.height / 2) - (CC.cardHeight / 2) + trayAreaPos.top + 145;
                let left = (trayAreaSize.width / 2) - (CC.cardWidth / 2) + trayAreaPos.left - ((settings.new_order.length-1)*25) / 2;

                CC.cardRegistry[card.id].pos = {top: top, left: left};

                return {top: top, left: left};

            // If there is already a tray area stack in this row
            } else {
                console.log("triggered 3");
                console.log(veryLastCard.id);
                let left = parseInt(("#card-" + veryLastCard.id).css("left")) + CC.cardWidth + 70;
                let top = veryLastCard.pos.top;

                CC.cardRegistry[card.id].pos = {top: top, left: left};

                return {top: top, left: left};
            }
        }

    // In case the tray area stack exists, so we need to calculate the position based on the first card in this tray area stack
    } else if (trayStackAreaExists) {
        let calcFactor = settings.new_order.indexOf(card.id);
        // Get position of the first card within the related tray area stack
        let firstCard = CC.cardRegistry[settings.new_order[0]];

        let left = firstCard.pos.left + (calcFactor * CC.optimalDistanceBetweenCardsAtOpponentsHand);
        let top = firstCard.pos.top;

        CC.cardRegistry[card.id].pos = {top: top, left: left};

        return {top: top, left: left};
    }

}

CC.generateUniqueHashFromNumber = function(number) {
    number = parseInt(number);
    let alphabet = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
    let remainding = number % 26;
    let multiplier = (number - remainding) / 26;
    let hash = alphabet[multiplier] + alphabet[parseInt(remainding)];

    return hash;

}

CC.generateTrayAreaRegistry = function() {
    let re = new RegExp(/tray_area_stack/);
    let cardsInRows = [];
    for (let i=1; i<CC.cardRegistry.length; i++) {
        if (re.test(CC.cardRegistry[i].semantic_pos)) {
            let idx = CC.generateUniqueHashFromNumber(Math.abs(CC.cardRegistry[i].pos.top));
            if (!cardsInRows[idx]) {
                cardsInRows[idx] = [];
            }
            if (!cardsInRows[idx][CC.cardRegistry[i].semantic_pos]) {
                cardsInRows[idx][CC.cardRegistry[i].semantic_pos] = [];
            }
            cardsInRows[idx][CC.cardRegistry[i].semantic_pos].push(CC.cardRegistry[i].id);
        }
    }

    return cardsInRows;
}

CC.updateTrayAreaCardsPositions = function() {

    // First generate a array representation for the rows and its containing stacks and cards
    let cardsInRows = CC.generateTrayAreaRegistry();

    let tempCopys = [];

    for (let i=0; i<CC.semanticPosCreationOrder.length; i++) {
        for (let rowIdx=0; rowIdx<Object.keys(cardsInRows).length; rowIdx++) {
            let idx = Object.keys(cardsInRows)[rowIdx];

            for (let x=0; x<Object.keys(cardsInRows[idx]).length; x++) {
                if (Object.keys(cardsInRows[idx])[x] === CC.semanticPosCreationOrder[i]) {
                    if (!tempCopys[idx]) {
                        tempCopys[idx] = [];
                    }
                    tempCopys[idx].push(cardsInRows[idx][CC.semanticPosCreationOrder[i]]);
                }
            }

        }
    }

    console.log(tempCopys);

    // Calculate and save row lengths
    let rowLengths = [];
    console.log("------------------- calc row length ----------------------");
    for (let rowIdx=0; rowIdx<Object.keys(cardsInRows).length; rowIdx++) {
        let idx = Object.keys(cardsInRows)[rowIdx];
        let length = 0;
        console.log(Object.keys(cardsInRows[idx]));
        for (let stackIdx=0; stackIdx < tempCopys[idx].length; stackIdx++) {
            length += CC.cardWidth;
            length += 70;
            length += (cardsInRows[idx][ Object.keys(cardsInRows[idx])[stackIdx] ].length - 1) * CC.optimalDistanceBetweenCardsAtOpponentsHand;
        }
        length -= 70;
        rowLengths.push(length);
    }

    for (let x=0; x<rowLengths.length; x++) {
        // Check row lengths
        if (rowLengths[x] > $(".tray-area").width()) {
            console.log("Row " + (x + 1) + " is to big");

            let sortedCardIds = [];
            let reversedCreationOrder = CC.semanticPosCreationOrder; //.reverse();
            let trayAreaStackName = "";

            for (let i = 0; i < reversedCreationOrder.length; i++) {
                if (cardsInRows[Object.keys(cardsInRows)[x]][reversedCreationOrder[i]]) {
                    trayAreaStackName = reversedCreationOrder[i];
                }
            }

            console.log("trayAreaStackName");
            console.log(trayAreaStackName);

            for (let i = 1; i < CC.cardRegistry.length; i++) {
                if (CC.cardRegistry[i].semantic_pos === trayAreaStackName) {
                    sortedCardIds.push(i);
                }
            }

            sortedCardIds = sortedCardIds.sort((a, b) => {
                if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                    return -1;
                }
                return 1;
            });

            let currentTop = parseInt($("#card-" + CC.cardRegistry[sortedCardIds[0]].id).css("top"));
            // Get tray area stacks within the targeted row if there exist some
            let cardsInRowsIdx = CC.generateUniqueHashFromNumber(currentTop + 145);

            if (!cardsInRows[cardsInRowsIdx]) {
                for (let i = 0; i < sortedCardIds.length; i++) {
                    // Calculate new top
                    let top = CC.cardRegistry[sortedCardIds[i]].pos.top + 145;
                    let left;
                    CC.cardRegistry[sortedCardIds[i]].pos.top = CC.cardRegistry[sortedCardIds[i]].pos.top + 145;

                    /** Calculate new left */


                    console.log("there are no other tray area stacks in targeted row");

                    // Iterate over each card of this tray area stack and reposition it to target row
                    // First get ids and order of them
                    let cardsInfos = [];
                    for (let x = 1; x < CC.cardRegistry.length; x++) {
                        if (CC.cardRegistry[x].semantic_pos === CC.cardRegistry[sortedCardIds[i]].semantic_pos) {
                            cardsInfos.push({id: x, order: CC.cardRegistry[x].order_pos});
                        }
                    }

                    // Now sort by order
                    cardsInfos = cardsInfos.sort((a, b) => {
                        if (a.order_pos < b.order_pos) {
                            return -1;
                        }
                        return 1;
                    });

                    console.log("check check");
                    console.log(cardsInfos);

                    // Iterate over them and manipulate
                    for (let x = 0; x < cardsInfos.length; x++) {
                        left = parseInt($(".tray-area").css("left")) + ($(".tray-area").width()/2) - (CC.cardWidth/2) - ((cardsInfos.length - 1) * 25) + (x * 25);
                        console.log("new left -------------------------");
                        console.log($(".tray-area").css("left") + " + " + ($(".tray-area").width()/2) + " - " + (CC.cardWidth/2) + " - " + ((cardsInfos.length - 1) * 25) + " + " +  (x * 25));
                        console.log(cardsInfos[x].id);
                        // Reposition
                        $("#card-" + cardsInfos[x].id).animate({top: top, left: left, zIndex: (x + 1)}, 500);

                        CC.cardRegistry[cardsInfos[x].id].pos = {top: top, left: left};
                    }
                }

            } else {

                sortedCardIds = [];
                reversedCreationOrder = CC.semanticPosCreationOrder; //.reverse();
                trayAreaStackName = "";

                for (let i = 0; i < reversedCreationOrder.length; i++) {
                    if (cardsInRows[Object.keys(cardsInRows)[x]][reversedCreationOrder[i]]) {
                        trayAreaStackName = reversedCreationOrder[i];
                    }
                }

                console.log("trayAreaStackName");
                console.log(trayAreaStackName);

                for (let i = 1; i < CC.cardRegistry.length; i++) {
                    if (CC.cardRegistry[i].semantic_pos === trayAreaStackName) {
                        sortedCardIds.push(i);
                    }
                }

                sortedCardIds = sortedCardIds.sort((a, b) => {
                    if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                        return -1;
                    }
                    return 1;
                });

                let top = CC.cardRegistry[sortedCardIds[0]].pos.top + 145;
                let left;

                let existingStacksByName = Object.keys(cardsInRows[cardsInRowsIdx])

                // Sort the existing stacks in order of they were beeing added to the tray area
                existingStacksByName = existingStacksByName.sort((a, b) => {
                    if (CC.semanticPosCreationOrder.indexOf(a) < CC.semanticPosCreationOrder.indexOf(b)) {
                        return -1;
                    }
                    return 1;
                });

                // Count total cards in this row
                let totalCards = 0;
                totalCards += existingStacksByName.map( (a) => {
                    for (let c=1; c<CC.cardRegistry.length; c++) {
                        if (CC.cardRegistry[c].semantic_pos === a) {
                            return 1;
                        }
                        return 0;
                    }
                } ).reduce( (accu, curVal) => {
                    return accu + curVal;
                } );
                console.log("total cards --------------------------------");
                console.log(totalCards);

                for (let y = 0; y < existingStacksByName.length; y++) {
                    for (let a = 0; a < sortedCardIds.length; a++) {
                        // Iterate over each card of this tray area stack and reposition it to target row
                        // First get ids and order of them
                        let cardsInfos = [];
                        for (let z = 1; z < CC.cardRegistry.length; z++) {
                            if (CC.cardRegistry[z].semantic_pos === CC.cardRegistry[sortedCardIds[a]].semantic_pos) {
                                cardsInfos.push({id: z, order: CC.cardRegistry[z].order_pos});
                            }
                        }

                        console.log("----------------------------- cardsinfos");
                        console.log(cardsInfos);

                        // Now sort by order
                        cardsInfos = cardsInfos.sort((a, b) => {
                            if (a.order_pos < b.order_pos) {
                                return -1;
                            }
                            return 1;
                        });

                        console.log("check check");
                        console.log(cardsInfos);

                        // Iterate over them and manipulate
                        for (let b = 0; b < cardsInfos.length; b++) {

                            let totalRowWidth = ((existingStacksByName.length - 1) * 70) + ((totalCards-existingStacksByName)*25) + (existingStacksByName*CC.cardWidth);
                            let leftgap =  (parseInt($(".tray-area").css("left")) + $(".tray-area").width()) -  totalRowWidth; //- ( (y*70) + CC.cardWidth + (b*25) )

                            left = leftgap + ( (y*70) + CC.cardWidth + (b*25) );

                            // Reposition
                            $("#card-" + cardsInfos[b].id).animate({top: top, left: left, zIndex: (cardsInfos.length - b)}, 500);

                            CC.cardRegistry[cardsInfos[b].id].pos = {top: top, left: left};
                        }

                    }

                }
            }
        }
    }
    console.log("--- sem pos ------");
    console.log(CC.semanticPosCreationOrder);

    // Recenter rows
    // Rows
    for (let i=0; i<rowLengths.length; i++) {

        let firstCardIsUpdated = false;

        // Sequentaly update each card position for this row
        for (let rowIdx=0; rowIdx<Object.keys(cardsInRows).length; rowIdx++) {
            // Calculate new gap from left
            let newGapFromLeft = ($(".tray-area").width() - rowLengths[rowIdx]) / 2;

            console.log("newgap row " + rowIdx + ": " + newGapFromLeft);

            let idx = Object.keys(cardsInRows)[rowIdx];

            // Stacks
            let previousStackLastCardId;
            for (let stackIdx=0; stackIdx < tempCopys[idx].length; stackIdx++) {
                let base;
                if (previousStackLastCardId) {
                    base = parseInt($("#card-" + previousStackLastCardId).css("left")) + 86 + 70;
                } else {
                    base = (newGapFromLeft + parseInt($(".tray-area").css("left")));
                }

                // Cards

                let sortedCardIds = [];
                for (let i=1; i<CC.cardRegistry.length; i++) {
                    if (CC.cardRegistry[i].semantic_pos === CC.cardRegistry[tempCopys[idx][stackIdx][0]].semantic_pos) {
                        sortedCardIds.push(i);
                    }
                }

                sortedCardIds = sortedCardIds.sort((a, b) => {
                    if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                        return -1;
                    }
                    return 1;
                });

                console.log("------- sorted ids ----------");
                console.log(sortedCardIds);

                for (let y=0; y<sortedCardIds.length; y++) {
                    let cardId = sortedCardIds[y];

                    console.log("stack no: " + (tempCopys[idx].length - stackIdx) + " cards: " + sortedCardIds.length);


                    if (!firstCardIsUpdated) {
                        $("#card-" + cardId).css("left", (newGapFromLeft + parseInt($(".tray-area").css("left")))).css("z-index", (y+1));
                        CC.cardRegistry[cardId].pos.left = (newGapFromLeft + parseInt($(".tray-area").css("left")));
                        firstCardIsUpdated = true;
                    } else {
                        $("#card-" + cardId).css("left", base + (y * 25)).css("z-index", (y+1));
                        CC.cardRegistry[cardId].pos.left = base + (y*25);
                    }

                    previousStackLastCardId = cardId;
                }
            }

        }

    }


}

CC.moveCard = function(card, options) {

    // Add the card to the semantic registry
    if (CC.semanticPosInfos[options.semantic_pos]) {
        let found = false;
        for (let i=0; i<CC.semanticPosInfos[options.semantic_pos].length; i++) {
            if (CC.semanticPosInfos[options.semantic_pos][i].id === card.id) {
                found = true;
            }
        }
        if (!found) {
            CC.semanticPosInfos[options.semantic_pos].push(card);
        }
    } else {
        console.log(card.semantic_pos + " erstellt");
        CC.semanticPosInfos[options.semantic_pos] = [];
        CC.semanticPosInfos[options.semantic_pos].push(card);
        CC.semanticPosCreationOrder.push(options.semantic_pos);
    }

    /** Update order position for card */
    CC.cardRegistry[card.id].order_pos = options.new_order.indexOf(card.id) + 1;

    /** Inject card picture into card element */
    if (!card.revealed) {
        card.revealed = true;
        $("#card-" + card.id).find(".card__face--back")
            .css("background", "url("+card.picture+") #fff no-repeat")
            .css("background-size", "78px 117px")
            .css("background-position", "center");
    }

    /** Remove card from semantic registry if it exists there. We will link this card later with its new semantic position again */
    console.log("--- moveCard ---");
    console.log("new semantic position of card to move: " + options.semantic_pos);

    // Search card in semantic registry and remove from there
    if (CC.semanticPosInfos[card.semantic_pos]) {
        for (let i = 0; i < CC.semanticPosInfos[card.semantic_pos].length; i++) {
            if (CC.semanticPosInfos[card.semantic_pos][i].id === card.id) {
                CC.semanticPosInfos[card.semantic_pos].splice(card.order_pos, 1);
            }
        }
    }

    // Set semantic position to the card object
    CC.cardRegistry[card.id].semantic_pos = options.semantic_pos;

    // This should not be done in here => should be in a extra update function after the move has finished
    // Update the order position of the card info objects in this semantic registry set
    for (let i=1; i<CC.cardRegistry.length; i++) {
        if (CC.cardRegistry[i].semantic_pos === card.semantic_pos) {
            CC.cardRegistry[i].order_pos = (options.new_order.indexOf(CC.cardRegistry[i].id)+1);
            $("#card-" + CC.cardRegistry[i].id).css("z-index", (options.new_order.indexOf(CC.cardRegistry[i].id)+1));
        }
    }

    /** Animate card to new position after a short 100ms delay because card picture injection may not be finished yet */
    setTimeout(function(){
        // Animates the flip
        CC.moveCardToPos(card, {
            delay: options.order_pos * 70,
            cb: () => {
                $("#card-" + card.id).find(".card").addClass("is-flipped");
                // Reposition the related cards due to changes on related semantic areas
                CC.rerenderGamefield();
            }
        });
    }, 100);

}

/** Animates a card to given top/left coordinates */
CC.moveCardToPos = function(card, options) {
    // Set default options object if no options are submitted
    options = options ? options : { delay: 0, cb: false };

    console.log("--- moveCardToPos ---");

    // Add the card info object to the semantic position registry
    if (CC.semanticPosInfos[card.semantic_pos]) {
        let found = false;
        for (let i=0; i<CC.semanticPosInfos[card.semantic_pos].length; i++) {
            if (CC.semanticPosInfos[card.semantic_pos][i].id === card.id) {
                found = true;
            }
        }
        if (!found) {
            CC.semanticPosInfos[card.semantic_pos].push(card);
        }
    } else {
        console.log(card.semantic_pos + " erstellt");
        CC.semanticPosInfos[card.semantic_pos] = [];
        CC.semanticPosInfos[card.semantic_pos].push(card);
        CC.semanticPosCreationOrder.push(card.semantic_pos);
    }

    // Perform animation
    $("#card-" + card.id )
        .delay(options.delay)
        .animate({
            top: card.pos.top,
            left: card.pos.left,
            myRotationProperty: 180
        }, {
            step: function(now, tween) {
                // Rotates the card if it has to be served to right or left player
                switch(card.semantic_pos) {
                    case "opponent_hand_right":
                        if (tween.prop === "myRotationProperty") {
                            $(this).css('-webkit-transform','rotate('+(now/2)+'deg)');
                            $(this).css('-moz-transform','rotate('+(now/2)+'deg)');
                            // add Opera, MS etc. variants
                            $(this).css('transform','rotate('+(now/2)+'deg)');
                        }
                        break;
                    case "opponent_hand_left":
                        if (tween.prop === "myRotationProperty") {
                            $(this).css('-webkit-transform','rotate(-'+(now/2)+'deg)');
                            $(this).css('-moz-transform','rotate(-'+(now/2)+'deg)');
                            // add Opera, MS etc. variants
                            $(this).css('transform','rotate(-'+(now/2)+'deg)');
                        }
                        break;
                    case "opponent_hand_top":
                        if (tween.prop === "myRotationProperty") {
                            $(this).css('-webkit-transform','rotate(-'+now+'deg)');
                            $(this).css('-moz-transform','rotate(-'+now+'deg)');
                            // add Opera, MS etc. variants
                            $(this).css('transform','rotate(-'+now+'deg)');
                        }
                        break;
                    default:
                }
            },
            duration: CC.cardsTravelTime,
            easing: "easeInOutCirc",
            // Apply interaction Event Handlers for card if its players card
            complete: function() {
                // Trigger a directly to this function passed callback if there was one received
                if (options.cb) {options.cb();}
                // Trigger the appropriate callbacks
                CC.onCardMoved(card);
                // Update the card elemnents z-index
                $("#card-" + card.id).css("z-index", card.id);

                let re = new RegExp(/tray_area_stack/g);
                if (re.test(card.semantic_pos)) {
                    CC.updateTrayAreaCardsPositions();
                }
            }
        });

}

/** Reposition and resize all cards */
CC.rerenderGamefield = function() {
    // Get the size of the games root container
    let gamefieldSize = { width: $(".gamefield").width(), height: $(".gamefield").height()};

    // Get the max values for card-to-card distances
    let optCardDistOpp = CC.optimalDistanceBetweenCardsAtOpponentsHand;
    let optCardDistPlayer = CC.optimalDistanceBetweenCardsAtHand;


    /** Reposition and resie all cards */
    for (let i=1; i<CC.cardRegistry.length; i++) {
        // Count the amount of cards which are already in the related semantic position
        // This is a necessity for calculating the card-to-card distances
        let countedCards = (CC.semanticPosInfos[CC.cardRegistry[i].semantic_pos]) ? (CC.semanticPosInfos[CC.cardRegistry[i].semantic_pos].length > CC.matchConfig.cardsPerPlayer) ? CC.matchConfig.cardsPerPlayer : CC.semanticPosInfos[CC.cardRegistry[i].semantic_pos].length + 1 : CC.matchConfig.cardsPerPlayer;

        // Set new card-to-card distance for vertical aligned cards
        if (optCardDistOpp * CC.matchConfig.cardsPerPlayer + CC.cardWidth > gamefieldSize.height - (CC.verticalCardsPadding*2)) {
            CC.distanceBetweenCardsAtOpponentsHandY = ((gamefieldSize.height - (CC.verticalCardsPadding*2)) - CC.cardWidth) / (countedCards);
        } else {
            CC.distanceBetweenCardsAtOpponentsHandY = optCardDistOpp;
        }

        // Set new card-to-card distance for bottom horizontal aligned cards
        if (optCardDistPlayer * CC.matchConfig.cardsPerPlayer + CC.cardWidth > gamefieldSize.width - (CC.horizontalCardsPadding*2)) {
            CC.distanceBetweenCardsAtHand = ((gamefieldSize.width - (CC.horizontalCardsPadding*2)) - CC.cardWidth) / (countedCards);
            if (CC.distanceBetweenCardsAtHand > optCardDistPlayer) {
                CC.distanceBetweenCardsAtHand = optCardDistPlayer;
            }
        } else {
            CC.distanceBetweenCardsAtHand = optCardDistPlayer;
        }

        // Set new card-to-card distance for top horizontal aligned cards
        if (optCardDistOpp * CC.matchConfig.cardsPerPlayer + CC.cardWidth > gamefieldSize.width - (CC.horizontalCardsPadding*2)) {
            CC.distanceBetweenCardsAtOpponentsHandX = ((gamefieldSize.width - (CC.horizontalCardsPadding*2)) - CC.cardWidth) / (countedCards);
            if (CC.distanceBetweenCardsAtOpponentsHandX > optCardDistOpp) {
                CC.distanceBetweenCardsAtOpponentsHandX = optCardDistOpp;
            }
        } else {
            CC.distanceBetweenCardsAtOpponentsHandX = optCardDistOpp;
        }

        /** Set distance-to-first-card for vertical and horizontal player cards */
        CC.gapToFirstHorizontalCard = (parseInt($(".gamefield").width()) - (countedCards * CC.distanceBetweenCardsAtHand + (CC.cardWidth - CC.distanceBetweenCardsAtHand))) / 2 - CC.distanceBetweenCardsAtHand;
        CC.gapToFirstOppHorizontalCard = (parseInt($(".gamefield").width()) - ((countedCards+1) * CC.distanceBetweenCardsAtOpponentsHandX + (CC.cardWidth - CC.distanceBetweenCardsAtOpponentsHandX))) / 2 - CC.distanceBetweenCardsAtOpponentsHandX;
        CC.gapToFirstOppVerticalCard = (parseInt($(".gamefield").height()) - (countedCards * CC.distanceBetweenCardsAtOpponentsHandY + (CC.cardWidth - CC.distanceBetweenCardsAtOpponentsHandY))) / 2 - CC.distanceBetweenCardsAtOpponentsHandY;

        /** Reposition and resize the related card */
        CC.updateCard(CC.cardRegistry[i]);
    }

    /** Reposition and resize tray area */
    // Determine new width for tray area
    let trayAreaWidth = $(".gamefield").width() - 300;

    // Determine new height for tray area
    let trayAreaHeight = $(".gamefield").height() - 212;

    // Update tray area
    $(".tray-area").css("width", trayAreaWidth);
    $(".tray-area").css("height", trayAreaHeight);
}

/**
 * Refreshes the position and size of a single card
 * @param card - the object representation of a card
 */
CC.updateCard = function(card) {
    let newPos = CC.calculateCardPosition(card);

    let unused = 0;
    for (let i=1; i<CC.cardRegistry.length; i++) {
        if (CC.cardRegistry[i].semantic_pos === "unused_stack") {
            unused++;
        }
    }
    if (card.semantic_pos === "unused_stack") {
        newPos.top = newPos.top + (card.subId*0.2) - (unused*0.2);
        card.z_index = 99;
    }

    $("#card-" + card.id)
        .css("top", newPos.top)
        .css("left", newPos.left)
        .css("width", CC.cardWidth)
        .css("height", CC.cardHeight);
}

/**
 * Generates as much card elements as cards are configured in the matchconfig
 * @returns {string[]} A string with all card html elements
 */
CC.generateCardElems = function() {
    let cardElems = CC.cardRegistry.map( (card, i) => {
        return '<div class="scene" id="card-' + CC.cardRegistry[(CC.cardRegistry.length - i)].id + '" style="z-index: 99; top: calc(50% + 12px - ' + (i*0.2) + 'px);">' +
                    '<div class="card">' +
                        '<div class="card__face card__face--front"><p>' + CC.cardRegistry[(CC.cardRegistry.length - i)].id + '</p></div>' +
                        '<div class="card__face card__face--back"></div>' +
                    '</div>' +
                '</div>';
    } );

    return cardElems;
}

/**
 * Responsible for triggering callbacks which are related with a card move
 * This runs everytime no matter what card is finished moving from a to b
 *
 * @param card - the object representation of a card
 */
CC.onCardMoved = function(card) {

    /**
     * Trigger various callbacks in the card-distribution phase
     */
    if (!CC.allCardsHandedOut) {
        /**
         * Increment the received-cards-counter for the currently affected table position
         */
        switch (card.semantic_pos) {
            case "player_hand":
                for (let i = 0; i < CC.matchConfig.users.length; i++) {
                    if (CC.matchConfig.users[i].table_pos === 'player_hand') {
                        CC.finishedCardAnimations["player_hand"]++;
                    }
                }
                break;
            case "opponent_hand_left":
                for (let i = 0; i < CC.matchConfig.users.length; i++) {
                    if (CC.matchConfig.users[i].table_pos === 'opponent_hand_left') {
                        CC.finishedCardAnimations["opponent_hand_left"]++;
                    }
                }
                break;
            case "opponent_hand_top":
                for (let i = 0; i < CC.matchConfig.users.length; i++) {
                    if (CC.matchConfig.users[i].table_pos === 'opponent_hand_top') {
                        CC.finishedCardAnimations["opponent_hand_top"]++;
                    }
                }
                break;
            case "opponent_hand_right":
                for (let i = 0; i < CC.matchConfig.users.length; i++) {
                    if (CC.matchConfig.users[i].table_pos === 'opponent_hand_right') {
                        CC.finishedCardAnimations["opponent_hand_right"]++;
                    }
                }
                break;
            default:
                break;
        }

        /**
         * Triggers for every card on a specific table position
         */
        for (let i = 0; i < CC.onCardMoveCbs.length; i++) {
            if (CC.onCardMoveCbs[i].condition === "every_card" && CC.onCardMoveCbs[i].on === "distribution") {
                switch (CC.onCardMoveCbs[i].affected) {
                    case "full_table":
                        CC.onCardMoveCbs[i].handler(card);
                        break;
                    case "player_hand":
                        if (card.semantic_pos === "player_hand") {
                            CC.onCardMoveCbs[i].handler(card);
                        }
                        break;
                    case "opponent_hand_left":
                        if (card.semantic_pos === "opponent_hand_left") {
                            CC.onCardMoveCbs[i].handler(card);
                        }
                        break;
                    case "opponent_hand_top":
                        if (card.semantic_pos === "opponent_hand_top") {
                            CC.onCardMoveCbs[i].handler(card);
                        }
                        break;
                    case "opponent_hand_right":
                        if (card.semantic_pos === "opponent_hand_right") {
                            CC.onCardMoveCbs[i].handler(card);
                        }
                        break;
                    default:
                        break;
                }
            }
        }

        /**
         * Triggers if all table positions received their cards and sets the "CC.allCardsHandedOut" flag to true
         */
        if (card.id === (CC.matchConfig.cardsPerPlayer * CC.matchConfig.users.length)) {
            // Set a flag so we now that all initial cards are handed out
            CC.allCardsHandedOut = true;
            for (let i = 0; i < CC.onCardMoveCbs.length; i++) {
                if (CC.onCardMoveCbs[i].affected === "full_table" && CC.onCardMoveCbs[i].condition === "finish" && CC.onCardMoveCbs[i].on === "distribution") {
                    CC.onCardMoveCbs[i].handler(CC.distributedCards);
                }
            }
        }

        /**
         * Triggers if a specific table position received all its cards
         */
        for (let i = 0; i < CC.onCardMoveCbs.length; i++) {
            if (CC.onCardMoveCbs[i].condition === "finish" && CC.onCardMoveCbs[i].on === "distribution") {
                if (CC.onCardMoveCbs[i].affected === "player_hand") {
                    for (let x = 0; x < CC.matchConfig.users.length; x++) {
                        if (CC.finishedCardAnimations["player_hand"] === CC.matchConfig.cardsPerPlayer && CC.matchConfig.users[x].table_pos === "player_hand") {
                            CC.finishedCardAnimations["player_hand"] = 0;
                            CC.onCardMoveCbs[i].handler();
                        }
                    }
                } else if (CC.onCardMoveCbs[i].affected === "opponent_hand_left") {
                    for (let x = 0; x < CC.matchConfig.users.length; x++) {
                        if (CC.finishedCardAnimations["opponent_hand_left"] === CC.matchConfig.cardsPerPlayer && CC.matchConfig.users[x].table_pos === "opponent_hand_left") {
                            CC.finishedCardAnimations["opponent_hand_left"] = 0;
                            CC.onCardMoveCbs[i].handler();
                        }
                    }
                } else if (CC.onCardMoveCbs[i].affected === "opponent_hand_top") {
                    for (let x = 0; x < CC.matchConfig.users.length; x++) {
                        if (CC.finishedCardAnimations["opponent_hand_top"] === CC.matchConfig.cardsPerPlayer && CC.matchConfig.users[x].table_pos === "opponent_hand_top") {
                            CC.finishedCardAnimations["opponent_hand_top"] = 0;
                            CC.onCardMoveCbs[i].handler();
                        }
                    }
                } else if (CC.onCardMoveCbs[i].affected === "opponent_hand_right") {
                    for (let x = 0; x < CC.matchConfig.users.length; x++) {
                        if (CC.finishedCardAnimations["opponent_hand_right"] === CC.matchConfig.cardsPerPlayer && CC.matchConfig.users[x].table_pos === "opponent_hand_right") {
                            CC.finishedCardAnimations["opponent_hand_right"] = 0;
                            CC.onCardMoveCbs[i].handler();
                        }
                    }
                }
            }
        }
    }

    /**
     * Trigger various callbacks in the gaming phase
     */
    for (let i=0; i<CC.onCardMoveCbs.length; i++) {
        // If a card from deck is moved to tray stack
        if (CC.onCardMoveCbs[i].on === "deck_to_tray_stack" && card.semantic_move === "deck_to_tray_stack") {
            if (CC.onCardMoveCbs[i].condition.split(":")[0] === "cardid" && parseInt(CC.onCardMoveCbs[i].condition.split(":")[1]) === card.id) {
                CC.onCardMoveCbs[i].handler(card);
                if (CC.onCardMoveCbs[i].usage === "one_time") {
                    CC.onCardMoveCbs.splice(i, 1);
                }
            }
        }
    }

}

export default CardsController;