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
                    cardId: 1,
                    picture: six_of_clubs,
                    semantic_pos: "tray_area_stack_1",
                    new_order: [1, 2, 3] // card ids
                }
            ]
        };

        // Prepare card move
        GC.CardsController.cardRegistry[received.moves[0].cardId].picture = received.moves[0].picture;
        GC.CardsController.cardRegistry[received.moves[0].cardId].semantic_pos = received.moves[0].semantic_pos;
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[received.moves[0].cardId], {semantic_pos: received.moves[0].semantic_pos, new_order: received.moves[0].new_order})


    });

    // Testing the moveCard function...
    $("#test-move-btn").click(function() {
        GC.CardsController.cardRegistry[1].picture = nine_of_clubs;
        GC.CardsController.cardRegistry[1].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[1].pos = {top: 200, left: (1*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[1], {new_order: [1, 2, 3, 4, 5]});

        GC.CardsController.cardRegistry[2].picture = ten_of_clubs;
        GC.CardsController.cardRegistry[2].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[2].pos = {top: 200, left: (2*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[2], {new_order: [1, 2, 3, 4, 5]});

        GC.CardsController.cardRegistry[3].picture = jack_of_clubs;
        GC.CardsController.cardRegistry[3].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[3].pos = {top: 200, left: (3*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[3], {new_order: [1, 2, 3, 4, 5]});

        GC.CardsController.cardRegistry[4].picture = queen_of_clubs;
        GC.CardsController.cardRegistry[4].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[4].pos = {top: 200, left: (4*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[4], {new_order: [1, 2, 3, 4, 5]});

        GC.CardsController.cardRegistry[5].picture = king_of_clubs
        GC.CardsController.cardRegistry[5].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[5].pos = {top: 200, left: (5*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[5], {new_order: [1, 2, 3, 4, 5]});

        GC.CardsController.cardRegistry[6].picture = ace_of_clubs;
        GC.CardsController.cardRegistry[6].semantic_pos = "tray_area_stack_1";
        GC.CardsController.cardRegistry[6].pos = {top: 200, left: (6*70)};
        GC.CardsController.moveCard(GC.CardsController.cardRegistry[6], { new_order: [1, 2, 3, 4, 5]});
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

// Listens for window resizing so we can adjust the view
GC.listenForBrowserResize = function() {
    window.requestAnimationFrame(() => {

        let curBrowserWidth = parseInt($(window).width());
        let curBrowserHeight = parseInt($(window).height());

        /** Update card sizes and positions */
        if ( curBrowserWidth !== GC.browserSize.width || curBrowserHeight !== GC.browserSize.height ) {
            if (Math.abs(curBrowserWidth - GC.browserSize.width) > 10 || Math.abs(curBrowserHeight - GC.browserSize.height) > 10) {
                GC.browserSize = {width: curBrowserWidth, height: curBrowserHeight};
                // Reposition and adjust all gamefield components
                GC.CardsController.rerenderGamefield();
            }
        }

        GC.listenForBrowserResize();
    });
}

export default GameController;