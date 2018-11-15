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
        if (i == 9) {
            console.log("top pos of 9: " + $("#card-" + i).css("top"));
        }
        if (re.test(CC.cardRegistry[i].semantic_pos)) {
            let idx = CC.generateUniqueHashFromNumber(CC.cardRegistry[i].pos.top);
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

CC.getTrayAreaRegistrySorted = function() {
    let trayAreaRegistry = CC.generateTrayAreaRegistry();
    let trayAreaRegistrySorted = [];
    for (let i=0; i<CC.semanticPosCreationOrder.length; i++) {
        for (let y=0; y<Object.keys(trayAreaRegistry).length; y++) {
            let rowIdx = Object.keys(trayAreaRegistry)[y];

            for (let x=0; x<Object.keys(trayAreaRegistry[rowIdx]).length; x++) {
                if (Object.keys(trayAreaRegistry[rowIdx])[x] === CC.semanticPosCreationOrder[i]) {
                    if (!trayAreaRegistrySorted[rowIdx]) {
                        trayAreaRegistrySorted[rowIdx] = [];
                    }
                    trayAreaRegistrySorted[rowIdx].push(trayAreaRegistry[rowIdx][CC.semanticPosCreationOrder[i]]);
                }
            }
        }
    }

    return trayAreaRegistrySorted;
}

CC.getCurrentTrayAreaRowWidths = function() {
    let trayAreaRegistrySorted = CC.getTrayAreaRegistrySorted();
    let rowWidths = [];

    for (let i=0; i<Object.keys(trayAreaRegistrySorted).length; i++) {
        let rowIdx = Object.keys(trayAreaRegistrySorted)[i];
        let width = 0;

        for (let stackIdx=0; stackIdx < Object.keys(trayAreaRegistrySorted[rowIdx]).length; stackIdx++) {
            width += CC.cardWidth;
            width += 70;
            width += (trayAreaRegistrySorted[rowIdx][stackIdx].length - 1) * CC.optimalDistanceBetweenCardsAtOpponentsHand;
        }
        width -= 70;
        rowWidths.push(width);
    }

    return rowWidths;
}

CC.updateTrayAreaCardsPositions = function() {
    let trayAreaRegistry = CC.generateTrayAreaRegistry();
    // Generate a sorted version of trayAreaRegistry. Ordered by the time they were added to the tray area
    let trayAreaRegistrySorted = CC.getTrayAreaRegistrySorted();

    // Calculate and save the width of each row in the tray area
    let rowWidths = CC.getCurrentTrayAreaRowWidths();

    // Iterate over each row and if they are to big, get dirty and rearrange stacks
    for (let x=0; x<rowWidths.length; x++) {

        // In case the current row is to big
        if (rowWidths[x] > $(".tray-area").width()) {
            console.log("Row " + (x + 1) + " is to big");

            // Get the id/name of the last stack in this row so we can rearrange its position to smaller the row width
            // First get the stack ids/names and reverse the order so the first one is the very last one we have added to tray area
            let reversedCreationOrder = CC.semanticPosCreationOrder; //.reverse();

            // Will hold the id/name of the last stack in this row
            let trayAreaStackName = "";

            // Find out the last stack id/name by iterating over this rows stacks until we find the one which was added last to this row
            for (let i = 0; i < reversedCreationOrder.length; i++) {
                if (trayAreaRegistry[Object.keys(trayAreaRegistry)[x]][reversedCreationOrder[i]]) {
                    trayAreaStackName = reversedCreationOrder[i];
                }
            }
            console.log('name of last stack in row "' + (x+1) + '": ' + trayAreaStackName);

            // Now get all the card ids of the cards in this last stack
            let cardIdsOfLastStack = [];
            for (let i = 1; i < CC.cardRegistry.length; i++) {
                if (CC.cardRegistry[i].semantic_pos === trayAreaStackName) {
                    cardIdsOfLastStack.push(i);
                }
            }

            // Order them after their order position
            let orderedCardIdsOfLastStack = cardIdsOfLastStack.sort((a, b) => {
                if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                    return -1;
                }
                return 1;
            });

            // Get the row index of the row to which we want to add the last stack of the current row
            let currentTop = parseInt($("#card-" + orderedCardIdsOfLastStack[0]).css("top"));
            let regIdxOfTargetRow = CC.generateUniqueHashFromNumber(currentTop + CC.cardHeight);

            console.log("regIdxOfTargetRow");
            console.log(regIdxOfTargetRow);

            // We take different actions on whether there are stacks in the targeted row or not
            // If there are no other stacks...
            if (!trayAreaRegistrySorted[regIdxOfTargetRow]) {
                console.log("there are no other tray area stacks in targeted row which has idx: " + regIdxOfTargetRow);

                /** Calculate new top value for the card of the last stack */
                // First reevaluate the vertical gap to the first row
                let verticalGap = (($(".tray-area").height() - ((rowWidths.length * CC.cardHeight) + ((rowWidths.length-1) * 20))) / 2) + parseInt($(".tray-area").css("top"));

                // Calculate new top value for the cards based on the vertical gap
                let top = verticalGap + CC.cardHeight + 20; // gap + first row height + vertical space between card rows

                /** Iterate over each card of the last stack, calculate its left position, update registry values and reposition it finally */
                // This number is a static part of the upcoming calculations and can be defined out of the loop
                let numberOfCardsInLastStack = orderedCardIdsOfLastStack.length;

                for (let i = 0; i < orderedCardIdsOfLastStack.length; i++) {
                    // Calcualte new left
                    let left;
                    left = parseInt($(".tray-area").css("left")) + ($(".tray-area").width()/2) - (CC.cardWidth/2) - ((numberOfCardsInLastStack - 1) * 25) + (x * 25);

                    // debug
                    console.log('new position for card id "' + orderedCardIdsOfLastStack[i] + '" is left "' + left + '" top "' + top + '"');

                    // Reposition
                    $("#card-" + orderedCardIdsOfLastStack[i]).css({top: top, left: left, zIndex: (i + 1)});

                    // Update registry
                    CC.cardRegistry[orderedCardIdsOfLastStack[i]].pos = {top: top, left: left};
                }

                // Trigger recentering the tray area rows
                CC.recenterTrayAreaRows();

            // There are other stacks in the targeted row...
            } else {

                orderedCardIdsOfLastStack = [];
                reversedCreationOrder = CC.semanticPosCreationOrder; //.reverse();
                trayAreaStackName = "";

                for (let i = 0; i < reversedCreationOrder.length; i++) {
                    if (trayAreaRegistrySorted[Object.keys(trayAreaRegistrySorted)[x]][reversedCreationOrder[i]]) {
                        trayAreaStackName = reversedCreationOrder[i];
                    }
                }

                console.log("trayAreaStackName");
                console.log(trayAreaStackName);

                for (let i = 1; i < CC.cardRegistry.length; i++) {
                    if (CC.cardRegistry[i].semantic_pos === trayAreaStackName) {
                        orderedCardIdsOfLastStack.push(i);
                    }
                }

                orderedCardIdsOfLastStack = orderedCardIdsOfLastStack.sort((a, b) => {
                    if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                        return -1;
                    }
                    return 1;
                });

                let left;

                let existingStacksByName = Object.keys(trayAreaRegistrySorted[regIdxOfTargetRow])

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
                    for (let a = 0; a < orderedCardIdsOfLastStack.length; a++) {
                        // Iterate over each card of this tray area stack and reposition it to target row
                        // First get ids and order of them
                        let cardsInfos = [];
                        for (let z = 1; z < CC.cardRegistry.length; z++) {
                            if (CC.cardRegistry[z].semantic_pos === CC.cardRegistry[orderedCardIdsOfLastStack[a]].semantic_pos) {
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
                            let gap = ($(".tray-area").height() - ((rowWidths.length * CC.cardHeight) + ((rowWidths.length-1) * 20))) / 2;
                            let top = gap + 20+CC.cardHeight + parseInt($(".tray-area").css("top"));

                            // Reposition
                            $("#card-" + cardsInfos[b].id).css({top: top, left: left, zIndex: (cardsInfos.length - b)});

                            CC.cardRegistry[cardsInfos[b].id].pos = {top: top, left: left};
                        }

                        // Trigger recentering the tray area rows
                        CC.recenterTrayAreaRows();
                    }

                }
            }
        } else {
            // Trigger recentering the tray area rows
            CC.recenterTrayAreaRows();
        }
    }

}

CC.recenterTrayAreaRows = function() {
    console.log("-------------------------------");
    console.log("recenterTrayAreaRows triggered");
    // Generate a sorted version of trayAreaRegistry. Ordered by the time they were added to the tray area
    let trayAreaRegistrySorted = CC.getTrayAreaRegistrySorted();

    // Calculate and save the width of each row in the tray area
    let rowWidths = CC.getCurrentTrayAreaRowWidths();
    console.log("rowWidths:");
    console.log(rowWidths);
    // Recenter rows
    // Rows
    for (let i=0; i<rowWidths.length; i++) {

        let previousStackLastCardId = false;

        let verticalGap = parseInt($(".tray-area").css("top")) + ($(".tray-area").height() - (rowWidths.length*CC.cardHeight) - ((rowWidths.length-1) * 20) ) / 2
        let top = verticalGap + (i*(20+CC.cardHeight));

        // Calculate new gap from left
        let newGapFromLeft = parseInt($(".tray-area").css("left")) + ($(".tray-area").width() - rowWidths[i]) / 2;

        for (let stackIdx=0; stackIdx < trayAreaRegistrySorted[Object.keys(trayAreaRegistrySorted)[i]].length; stackIdx++) {
            let firstCardIsUpdated = false;
            let base;
            if (previousStackLastCardId) {
                base = parseInt($("#card-" + previousStackLastCardId).css("left")) + 86 + 70;
            } else {
                base = newGapFromLeft;
            }

            let sortedCardIds = [];
            for (let x=1; x<CC.cardRegistry.length; x++) {
                if (CC.cardRegistry[x].semantic_pos === CC.cardRegistry[ trayAreaRegistrySorted[Object.keys(trayAreaRegistrySorted)[i]][stackIdx][0] ].semantic_pos) {
                    sortedCardIds.push(x);
                }
            }

            sortedCardIds = sortedCardIds.sort((a, b) => {
                if (CC.cardRegistry[a].order_pos < CC.cardRegistry[b].order_pos) {
                    return -1;
                }
                return 1;
            });

            for (let y=0; y<sortedCardIds.length; y++) {
                let cardId = sortedCardIds[y];

                let left = base;

                if (!firstCardIsUpdated) {
                    $("#card-" + cardId).css({left: left, top: top}).css("z-index", (y+1));
                    CC.cardRegistry[cardId].pos = {top: top, left: base};
                    firstCardIsUpdated = true;
                } else {
                    left += (y*25);
                    $("#card-" + cardId).css({left: left, top: top}).css("z-index", (y+1));
                    CC.cardRegistry[cardId].pos = {top: top, left: base + (y*25)};
                }

                if (y === sortedCardIds.length-1) {
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
                    CC.recenterTrayAreaRows();
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

    /** Reposition and resize all cards except tray area cards */
    for (let i=1; i<CC.cardRegistry.length; i++) {

        // Exclude tray area cards
        let re = new RegExp(/tray_area/);
        if (re.test(CC.cardRegistry[i].semantic_pos)) {
            continue;
        }

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