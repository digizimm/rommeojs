import React from 'react';
import $ from "jquery";
import './App.css';
import GameController from "./GameController";

class App extends React.Component {

    constructor() {
        super();

        this.matchConfig = {
            cards: 110,
            cardsPerPlayer: 13,
            users: [
                {
                    userid: 481,
                    username: "danny_teständerungfürgit",
                    table_pos: "player_hand"
                },
                {
                    userid: 124,
                    username: "heidi",
                    table_pos: "opponent_hand_right",
                }
            ],

        };
    }

    componentDidMount() {

        $("#start-game-btn").click(this.startGame);

        GameController.init(this.matchConfig);

        $(document).ready(function() {
            GameController.listenForBrowserResize();
        });
    }

    startGame() {
        GameController.startGame();
    }

    render() {
        return (
            <div>
                <h1>RommeoJS 0.1.0</h1>
                <div className="gamefield">
                    <div className="drop-staple"></div>
                    <div className="sorted-staple"></div>

                    <button id="start-game-btn">Spiel starten</button>
                    <button id="test-move-btn" style={{marginTop: "22px"}}>Move first 2</button>
                    <br />
                    <button id="test-move-btn2" style={{marginTop: "50px"}}>Move selected</button>
                    <br />
                    <button id="add-new-tray-area-stack">add new stack</button>
                    <br />
                    <button id="add-another-tray-area-stack">add another stack</button>
                    <br />
                    <button id="receiver-test" style={{marginTop: "70px"}}>Receiver test</button>

                </div>
            </div>
        )
    }

}

export default App;