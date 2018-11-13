import $ from "jquery";
import "jquery-ui-bundle";
import { RommeoConfig } from './config';

const CardsController = {};
const CC = CardsController;

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
    CC.distributedCardsInfos = [];
    // Will hold every card info object
    CC.cardsInfos = [];
    // Semantic position infos
    CC.semanticPosInfos = [];
    // Setup default semantic registry
    CC.semanticPosInfos["unused_stack"] = [];
    // Setup default card info object for each card and add it to default semantic registry
    for (let i=1; i<=matchConfig.cards; i++) {
        CC.cardsInfos[i] = {
            id: i,
            picture: null,
            pos: {top: null, left: null},
            order_pos: (i % CC.matchConfig.cardsPerPlayer === 0) ? CC.matchConfig.cardsPerPlayer : i % CC.matchConfig.cardsPerPlayer,
            semantic_pos: "unused_stack",
            revealed: false,
            z_index: (i % CC.matchConfig.cardsPerPlayer === 0) ? CC.matchConfig.cardsPerPlayer : i % CC.matchConfig.cardsPerPlayer
        };
        // Add card to default semantic registry
        CC.semanticPosInfos["unused_stack"].push(CC.cardsInfos[i]);
    }
    // Extend user object with a got-all-initial-cards flag
    for (let i=0; i<CC.matchConfig.users.length; i++) {
        CC.matchConfig.users[i].gotAllInitialCards = false;
    }
}

CC.getCardsInfos = function() {
    return CC.cardsInfos;
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
            let cardInfo = CC.getCardInfoFromDeck();

            // Set card sub id
            cardInfo.subId = CC.matchConfig.cardsPerPlayer-cardNo;

            // Set semantic position
            cardInfo.semantic_pos = CC.matchConfig.users[userIdx].table_pos;

            // Add card info object to semantic registry
            if (!CC.semanticPosInfos[cardInfo.semantic_pos]) {
                CC.semanticPosInfos[cardInfo.semantic_pos] = [];
                cardInfo.order_pos = CC.semanticPosInfos[cardInfo.semantic_pos].length;
            } else {
                CC.semanticPosInfos[cardInfo.semantic_pos].push(cardInfo);
                cardInfo.order_pos = CC.semanticPosInfos[cardInfo.semantic_pos].length;
            }

            // Calculate position for this card
            cardInfo.pos = CC.calculateCardPosition(cardInfo);

            // Calculate delay and set it
            let options = {delay: (userIdx * CC.delayBetweenDitributions) + (CC.sequentialDelayBetweenEachCardAnimation * parseInt(cardInfo.id))};

            // Initialize the animation
            CC.moveCardToPos(cardInfo, options);

            // Mark/save the card info object as distributed so we can work with it later on in a cb after distribution finished
            CC.distributedCardsInfos.push(cardInfo);
        }

        // Set flag that the related player received all its cards
        CC.matchConfig.users[userIdx].gotAllInitialCards = true;

        // Continue with distribution loop after short delay
        setTimeout(function(){ CC.distribute() }, CC.delayBetweenDitributions);
    }
}

/**
 * Calculates the card position based on its semantic and order position
 * @param cardInfo
 * @returns {{top: *, left: *}}
 */
CC.calculateCardPosition = function(cardInfo) {
    let top, left;

    switch(cardInfo.semantic_pos) {
        case "player_hand":
            // top position
            top = parseInt($(".gamefield").height()) - CC.cardHeight - CC.bottomHandPosAdjust;
            // left position
            left = (cardInfo.order_pos+1) * CC.distanceBetweenCardsAtHand + CC.gapToFirstHorizontalCard;
            break;
        case "opponent_hand_left":
            // top position
            top = cardInfo.order_pos * CC.distanceBetweenCardsAtOpponentsHandY + CC.gapToFirstOppVerticalCard;
            // left position
            left = CC.leftHandPosAdjust;
            break;
        case "opponent_hand_top":
            // top position
            top = CC.topHandPosAdjust;
            // left position
            left = (cardInfo.order_pos+1) * CC.distanceBetweenCardsAtOpponentsHandX + CC.gapToFirstOppHorizontalCard;
            break;
        case "opponent_hand_right":
            // top position
            top = cardInfo.order_pos * CC.distanceBetweenCardsAtOpponentsHandY + CC.gapToFirstOppVerticalCard;
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

CC.addFirstCardToTrayStack = function() {
    // Get the card object for the very first card on the deck
    let deckCard = CC.getCardInfoFromDeck();
    deckCard.semantic_move = "deck_to_tray_stack";
    // Update semantic position for new tray stack card
    CC.cardsInfos[deckCard.id].semantic_pos = "tray_stack";
    // Animates the card to the tray stack
    CC.addCardToTrayStack(deckCard);

    CC.attachCbOnCardMove({
        on: "deck_to_tray_stack",
        condition: "cardid:" + deckCard.id,
        usage: "one_time",
        handler: CC.onFirstDeckToTrayStackCard
    });
}

CC.onFirstDeckToTrayStackCard = function(cardInfo) {
    // Animates the flip
    $("#card-" + cardInfo.id).find(".card").addClass("is-flipped");
    // Adds click event to the new tray stack card
    $('#card-' + cardInfo.id).click(function() {
        alert("picked");
    });

    /** Has to be exluded from here since its not related to this function... */
    // Makes the very top deck and tray stack card shine
    $("#card-" + cardInfo.id).find(".card").addClass("highlight-card");
    cardInfo = CC.getCardInfoFromDeck();
    $("#card-" + cardInfo.id).find(".card").addClass("highlight-card");
}

CC.addCardToTrayStack = function(cardInfo) {
    // Get the tray stack position
    let trayStackPos = {top: $(".drop-staple").css("top"), left: $(".drop-staple").css("left")};
    // Set tray stack position as new card position
    cardInfo.pos = trayStackPos;
    // Animate card to tray stack
    CC.moveCardToPos(cardInfo);
}

CC.attachCbOnCardMove = function(cbsInfos) {
    cbsInfos = Array.isArray(cbsInfos) ? cbsInfos : [cbsInfos];
    CC.onCardMoveCbs = CC.onCardMoveCbs.concat(cbsInfos);
}

CC.getCardInfoFromDeck = function() {
    for (let i=1; i<CC.cardsInfos.length; i++) {
        if (CC.cardsInfos[i].semantic_pos === "unused_stack") {
            return CC.cardsInfos[i];
        }
    }
}

CC.moveCard = function(cardInfo, options) {
    /** Inject card picture into card element */
    if (!cardInfo.revealed) {
        cardInfo.revealed = true;
        $("#card-" + cardInfo.id).find(".card__face--back")
            .css("background", "url("+cardInfo.picture+") #fff no-repeat")
            .css("background-size", "78px 117px")
            .css("background-position", "center");
    }

    /** Remove current semantic registry entry of this card info object */
    CC.semanticPosInfos[cardInfo.semantic_pos].splice(cardInfo.order_pos, 1);
    let x = 0;
    // Update the order position of the remaining card info objects in this semantic registry set
    for (let i=1; i<CC.cardsInfos.length; i++) {
        if (CC.cardsInfos[i].semantic_pos === cardInfo.semantic_pos && CC.cardsInfos[i].id !== cardInfo.id) {
            x++;
            CC.cardsInfos[i].order_pos = x;
        }
    }

    /** Update the card info object with its new coordinates, semantic position and order position */
    cardInfo.pos = {top: 100, left: 250 + (options.order_pos * CC.optimalDistanceBetweenCardsAtOpponentsHand)};
    cardInfo.semantic_pos = options.target;
    cardInfo.order_pos = options.order_pos;

    /** Animate card to new position after a short 100ms delay because card picture injection may not be finished yet */
    setTimeout(function(){
        // Animates the flip
        CC.moveCardToPos(cardInfo, {
            delay: options.order_pos * 70,
            cb: () => {
                $("#card-" + cardInfo.id).find(".card").addClass("is-flipped");
                // Reposition the related cards due to changes on related semantic areas
                CC.rerenderGamefield();
            }
        });
    }, 100);

}

/** Animates a card to given top/left coordinates */
CC.moveCardToPos = function(cardInfo, options) {
    // Set default options object if no options are submitted
    options = options ? options : { delay: 0, cb: false };

    // Perform animation
    $("#card-" + cardInfo.id )
        .delay(options.delay)
        .animate({
            top: cardInfo.pos.top,
            left: cardInfo.pos.left,
            myRotationProperty: 180
        }, {
            step: function(now, tween) {
                // Rotates the card if it has to be served to right or left player
                switch(cardInfo.semantic_pos) {
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
                // Add the card info object to the semantic position registry
                if (CC.semanticPosInfos[cardInfo.semantic_pos]) {
                    let found = false;
                    for (let i=0; i<CC.semanticPosInfos[cardInfo.semantic_pos].length; i++) {
                        if (CC.semanticPosInfos[cardInfo.semantic_pos][i].id === cardInfo.id) {
                            found = true;
                        }
                    }
                    if (!found) {
                        CC.semanticPosInfos[cardInfo.semantic_pos].push(cardInfo);
                    }
                } else {
                    CC.semanticPosInfos[cardInfo.semantic_pos] = [cardInfo];
                }
                // Trigger a directly to this function passed callback if there was one received
                if (options.cb) {options.cb();}
                // Trigger the appropriate callbacks
                CC.onCardMoved(cardInfo);
                // Update the card elemnents z-index
                $("#card-" + cardInfo.id).css("z-index", cardInfo.z_index);
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
    for (let i=1; i<CC.cardsInfos.length; i++) {
        // Count the amount of cards which are already in the related semantic position
        // This is a necessity for calculating the card-to-card distances
        let countedCards = (CC.semanticPosInfos[CC.cardsInfos[i].semantic_pos]) ? (CC.semanticPosInfos[CC.cardsInfos[i].semantic_pos].length > CC.matchConfig.cardsPerPlayer) ? CC.matchConfig.cardsPerPlayer : CC.semanticPosInfos[CC.cardsInfos[i].semantic_pos].length + 1 : CC.matchConfig.cardsPerPlayer;

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
        CC.updateCard(CC.cardsInfos[i]);
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
 * @param cardInfo - the object representation of a card
 */
CC.updateCard = function(cardInfo) {
    let newPos = CC.calculateCardPosition(cardInfo);

    let unused = 0;
    for (let i=1; i<CC.cardsInfos.length; i++) {
        if (CC.cardsInfos[i].semantic_pos === "unused_stack") {
            unused++;
        }
    }
    if (cardInfo.semantic_pos === "unused_stack") {
        newPos.top = newPos.top + (cardInfo.subId*0.2) - (unused*0.2);
        cardInfo.z_index = 99;
    }

    $("#card-" + cardInfo.id)
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
    let cardElems = CC.cardsInfos.map( (card, i) => {
        return '<div class="scene" id="card-' + CC.cardsInfos[(CC.cardsInfos.length - i)].id + '" style="z-index: 99; top: calc(50% + 12px - ' + (i*0.2) + 'px);">' +
                    '<div class="card">' +
                        '<div class="card__face card__face--front"><p>' + CC.cardsInfos[(CC.cardsInfos.length - i)].id + '</p></div>' +
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
 * @param cardInfo - the object representation of a card
 */
CC.onCardMoved = function(cardInfo) {

    /**
     * Trigger various callbacks in the card-distribution phase
     */
    if (!CC.allCardsHandedOut) {
        /**
         * Increment the received-cards-counter for the currently affected table position
         */
        switch (cardInfo.semantic_pos) {
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
                        CC.onCardMoveCbs[i].handler(cardInfo);
                        break;
                    case "player_hand":
                        if (cardInfo.semantic_pos === "player_hand") {
                            CC.onCardMoveCbs[i].handler(cardInfo);
                        }
                        break;
                    case "opponent_hand_left":
                        if (cardInfo.semantic_pos === "opponent_hand_left") {
                            CC.onCardMoveCbs[i].handler(cardInfo);
                        }
                        break;
                    case "opponent_hand_top":
                        if (cardInfo.semantic_pos === "opponent_hand_top") {
                            CC.onCardMoveCbs[i].handler(cardInfo);
                        }
                        break;
                    case "opponent_hand_right":
                        if (cardInfo.semantic_pos === "opponent_hand_right") {
                            CC.onCardMoveCbs[i].handler(cardInfo);
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
        if (cardInfo.id === (CC.matchConfig.cardsPerPlayer * CC.matchConfig.users.length)) {
            // Set a flag so we now that all initial cards are handed out
            CC.allCardsHandedOut = true;
            for (let i = 0; i < CC.onCardMoveCbs.length; i++) {
                if (CC.onCardMoveCbs[i].affected === "full_table" && CC.onCardMoveCbs[i].condition === "finish" && CC.onCardMoveCbs[i].on === "distribution") {
                    CC.onCardMoveCbs[i].handler(CC.distributedCardsInfos);
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
        if (CC.onCardMoveCbs[i].on === "deck_to_tray_stack" && cardInfo.semantic_move === "deck_to_tray_stack") {
            if (CC.onCardMoveCbs[i].condition.split(":")[0] === "cardid" && parseInt(CC.onCardMoveCbs[i].condition.split(":")[1]) === cardInfo.id) {
                CC.onCardMoveCbs[i].handler(cardInfo);
                if (CC.onCardMoveCbs[i].usage === "one_time") {
                    CC.onCardMoveCbs.splice(i, 1);
                }
            }
        }
    }

}

export default CardsController;