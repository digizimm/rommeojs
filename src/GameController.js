import CardsController from './CardsController';
import $ from "jquery";
import './Card.css';
import { RommeoConfig } from './config';
import six_of_clubs from "./cards/png/6_of_clubs.png";
import nine_of_clubs from "./cards/png/9_of_clubs.png";
import ten_of_clubs from "./cards/png/10_of_clubs.png";
import jack_of_clubs from "./cards/png/jack_of_clubs.png";
import queen_of_clubs from "./cards/png/queen_of_clubs.png";
import king_of_clubs from "./cards/png/king_of_clubs.png";
import ace_of_clubs from "./cards/png/ace_of_clubs.png";

const GameController = {};
const GC = GameController;
GC.CardsController = CardsController;

GC.cardRegistry = {};

GC.init = function(matchConfig) {
    GC.matchConfig = matchConfig;

    GC.trayAreaPos = RommeoConfig.trayAreaPos;

    GC.setupGamefield();
    GC.CardsController.init(matchConfig);
    GC.cardRegistry = GC.CardsController.getCardRegistry();

    GC.browserSize = {width: 0, height: 0};

}

GC.setupGamefield = function() {
    $(document).ready(function() {

        // Generate and inject card elements
        let cardelems = CardsController.generateCardElems();
        $(".gamefield").append(cardelems);

        // Create and inject tray area
        $(".gamefield").append('<div class="tray-area"></div>');
        $(".tray-area").css("width", $(".gamefield").width() - GC.trayAreaPos.bottom);
        $(".tray-area").css("height", $(".gamefield").height() - GC.trayAreaPos.right);
        $(".tray-area").css("top", GC.trayAreaPos.top);
        $(".tray-area").css("left", GC.trayAreaPos.left);

    });
}

GC.startGame = function() {
    let distributionCbs = [
        {
            on: "distribution",
            condition: "finish",
            affected: "full_table",
            handler: GC.onCardDistributionFinished
        },
        {
            on: "distribution",
            condition: "finish",
            affected: "opponent_hand_top",
            handler: GC.onTopReceivedAll
        }
    ];

    GC.CardsController.distributeCards(distributionCbs);
}

GC.getCardRegistry = function() {
    return GC.cardRegistry;
}

GC.onCardDistributionFinished = (cardRegistry) => {
    console.log("all cards are distributed");

    // Update semantic position for all cards
    for (let i=0; i<cardRegistry.length; i++) {
        GC.cardRegistry[cardRegistry[i].id].semantic_pos = cardRegistry[i].semantic_pos;
    }

    // Apply event handlers
    GC.applyEventHandlers(cardRegistry);

    // Show first tray stack card
    GC.CardsController.addFirstCardToTrayStack(nine_of_clubs);

    $("#receiver-test").click(function() {

        let received = {
            moves: [
                {
                    cardId: 9,
                    picture: six_of_clubs,
                    semantic_pos: "tray_area_stack_1",
                    new_order: [9] // card ids
                }
            ]
        };

        let options = {semantic_pos: received.moves[0].semantic_pos, new_order: received.moves[0].new_order};

        // Find out the new card position
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[received.moves[0].cardId], options);

        // Set picture and semantic position for card
        GC.CardsController.cardRegistry[received.moves[0].cardId].picture = received.moves[0].picture;
        GC.CardsController.cardRegistry[received.moves[0].cardId].semantic_pos = received.moves[0].semantic_pos;

        // Move card
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[received.moves[0].cardId], options)


    });

    $("#test-move-btn").click(function() {
        // Testing the moveCard function...
        let options = {semantic_pos: "tray_area_stack_4", new_order: [1, 2]};
        GC.CardsController.cardRegistry[1].picture = nine_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[1], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[1], options);

        GC.CardsController.cardRegistry[2].picture = ten_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[2], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[2], options);
    });

    $("#add-new-tray-area-stack").click(function() {
        // Testing the moveCard function...
        let options = {semantic_pos: "tray_area_stack_2", new_order: [4, 5]};
        GC.CardsController.cardRegistry[4].picture = nine_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[4], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[4], options);

        GC.CardsController.cardRegistry[5].picture = ten_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[5], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[5], options);
    });

    $("#add-another-tray-area-stack").click(function() {
        // Testing the moveCard function...
        let options = {semantic_pos: "tray_area_stack_3", new_order: [7, 8, 6]};
        GC.CardsController.cardRegistry[7].picture = six_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[7], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[7], options);

        GC.CardsController.cardRegistry[8].picture = nine_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[8], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[8], options);

        GC.CardsController.cardRegistry[6].picture = ten_of_clubs;
        GC.CardsController.setCoordinatesFor(GC.CardsController.cardRegistry[6], options);
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[6], options);
    });

    // Testing the moveCard function...
    $("#test-move-btn2").click(function() {
        let selectedCardIds = [];
        $.each($(".card-is-selected"), (i, val) => {
            selectedCardIds.push(parseInt($(val).attr("id").split("-")[1]));
        });

        for (let i=0; i<selectedCardIds.length; i++) {
       //     GC.CardsController.cardsInfos[selectedCardIds[i]].picture = nine_of_clubs;
       //     GC.CardsController.moveCard(GC.CardsController.cardsInfos[selectedCardIds[i]], {target: "tray_area_stack_1", order_pos: (i+1)});
        }


    });
}

GC.onPlayerCardDistributed = function(card) {
    console.log("player received a card in distribution phase");

    GC.applyPlayerCardEventHandlers(card.id);
}

GC.onTopReceivedAll = function() {
    console.log("top received all cards");
}

GC.applyEventHandlers = function(cardRegistry) {

    // Debug
    $(window).click(function(event) {
     //   console.log(event);
    });

    // Apply necessary handlers for players cards
    for (let i=0; i<cardRegistry.length; i++) {
        if (cardRegistry[i].semantic_pos === "player_hand") {
            // Click
            $("#card-" + cardRegistry[i].id).click(function () {
                if ($(this).hasClass("card-is-selected")) {
                    $(this)
                        .stop()
                        .animate({top: parseInt($(".gamefield").height()) - parseInt($("#card-1").height()) - 24}, 100, "easeOutCirc")
                        .removeClass("card-is-selected")
                } else {
                    $(this)
                        .stop()
                        .animate({top: $(".gamefield").height() - parseInt($("#card-1").height()) - 48}, 100, "easeOutCirc")
                        .addClass("card-is-selected")
                }
            });

            // Mouseover
            $("#card-" + cardRegistry[i].id).mouseover(function () {
                if (!$(this).hasClass("card-is-selected")) {
                    $(this)
                        .stop()
                        .animate({top: $(".gamefield").height() - parseInt($("#card-1").height()) - 48}, 300, "easeOutCirc");
                }
            });

            // Mouseout
            $("#card-" + cardRegistry[i].id).mouseout(function () {
                if (!$(this).hasClass("card-is-selected")) {
                    $(this)
                        .stop()
                        .animate({top: parseInt($(".gamefield").height()) - parseInt($("#card-1").height()) - 24}, 300, "easeOutCirc")
                }
            });
        }
    }

}

GC.fps = 1;
GC.now = null;
GC.then = Date.now();
GC.interval = 1000/GC.fps;
GC.delta = null;

// Listens for window resizing so we can adjust the view
GC.listenForBrowserResize = function() {
    window.requestAnimationFrame(() => {

        GC.now = Date.now();
        GC.delta = GC.now - GC.then;

        if (GC.delta > GC.interval) {
            GC.then = GC.now - (GC.delta % GC.interval);

            let curBrowserWidth = parseInt($(window).width());
            let curBrowserHeight = parseInt($(window).height());

            /** Update card sizes and positions */
            if ( curBrowserWidth !== GC.browserSize.width || curBrowserHeight !== GC.browserSize.height ) {
                GC.browserSize = {width: curBrowserWidth, height: curBrowserHeight};
                // Reposition and adjust all gamefield components
                GC.CardsController.rerenderGamefield();
                GC.CardsController.updateTrayAreaCardsPositions();
            }
        }

        GC.listenForBrowserResize();
    });
}

export default GameController;