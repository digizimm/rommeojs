import CardsController from './CardsController';
import $ from "jquery";
import './Card.css';
import { RommeoConfig } from './config';
import nine_of_clubs from "./cards/png/9_of_clubs.png";
import ten_of_clubs from "./cards/png/10_of_clubs.png";
import jack_of_clubs from "./cards/png/jack_of_clubs.png";
import queen_of_clubs from "./cards/png/queen_of_clubs.png";
import king_of_clubs from "./cards/png/king_of_clubs.png";
import ace_of_clubs from "./cards/png/ace_of_clubs.png";

const GameController = {};
const GC = GameController;
GC.CardsController = CardsController;

GC.cardsInfos = {};

GC.init = function(matchConfig) {
    GC.matchConfig = matchConfig;

    GC.trayAreaPos = RommeoConfig.trayAreaPos;

    GC.setupGamefield();
    GC.CardsController.init(matchConfig);
    GC.cardsInfos = GC.CardsController.getCardsInfos();

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

GC.getCardsInfos = function() {
    return GC.cardsInfos;
}

GC.onCardDistributionFinished = (cardsInfos) => {
    console.log("all cards are distributed");

    // Update semantic position for all cards
    for (let i=0; i<cardsInfos.length; i++) {
        GC.cardsInfos[cardsInfos[i].id].semantic_pos = cardsInfos[i].semantic_pos;
    }

    // Apply event handlers
    GC.applyEventHandlers(cardsInfos);

    // Show first tray stack card
    GC.CardsController.addFirstCardToTrayStack();

    // Testing the moveCard function...
    $("#test-move-btn").click(function() {
        cardsInfos[0].picture = nine_of_clubs;
        GC.CardsController.moveCard(cardsInfos[0], {target: "tray_area_stack_1", order_pos: 1});

        cardsInfos[1].picture = ten_of_clubs;
        GC.CardsController.moveCard(cardsInfos[1], {target: "tray_area_stack_1", order_pos: 2});

        cardsInfos[2].picture = jack_of_clubs;
        GC.CardsController.moveCard(cardsInfos[2], {target: "tray_area_stack_1", order_pos: 3});

        cardsInfos[3].picture = queen_of_clubs;
        GC.CardsController.moveCard(cardsInfos[3], {target: "tray_area_stack_1", order_pos: 4});

        cardsInfos[4].picture = king_of_clubs;
        GC.CardsController.moveCard(cardsInfos[4], {target: "tray_area_stack_1", order_pos: 5});

        cardsInfos[5].picture = ace_of_clubs;
        GC.CardsController.moveCard(cardsInfos[5], {target: "tray_area_stack_1", order_pos: 6});
    });
    // Testing the moveCard function...
    $("#test-move-btn2").click(function() {
        let selectedCardIds = [];
        $.each($(".card-is-selected"), (i, val) => {
            selectedCardIds.push(parseInt($(val).attr("id").split("-")[1]));
        });

        for (let i=0; i<selectedCardIds.length; i++) {
            GC.CardsController.cardsInfos[selectedCardIds[i]].picture = nine_of_clubs;
            GC.CardsController.moveCard(GC.CardsController.cardsInfos[selectedCardIds[i]], {target: "tray_area_stack_1", order_pos: (i+1)});
        }


    });
}

GC.onPlayerCardDistributed = function(cardInfo) {
    console.log("player received a card in distribution phase");

    GC.applyPlayerCardEventHandlers(cardInfo.id);
}

GC.onTopReceivedAll = function() {
    console.log("top received all cards");
}

GC.applyEventHandlers = function(cardsInfos) {

    // Debug
    $(window).click(function(event) {
     //   console.log(event);
    });

    // Apply necessary handlers for players cards
    for (let i=0; i<cardsInfos.length; i++) {
        if (cardsInfos[i].semantic_pos === "player_hand") {
            // Click
            $("#card-" + cardsInfos[i].id).click(function () {
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
            $("#card-" + cardsInfos[i].id).mouseover(function () {
                if (!$(this).hasClass("card-is-selected")) {
                    $(this)
                        .stop()
                        .animate({top: $(".gamefield").height() - parseInt($("#card-1").height()) - 48}, 300, "easeOutCirc");
                }
            });

            // Mouseout
            $("#card-" + cardsInfos[i].id).mouseout(function () {
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