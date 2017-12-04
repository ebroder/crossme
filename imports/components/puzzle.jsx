import React from 'react';
import classNames from 'classnames';
import { createContainer, withTracker } from 'meteor/react-meteor-data';

import Sidebar from './controls.jsx';

/* global Router */
/* global Puzzles, FillsBySquare, Clues, Squares, SquaresByPosition */

function cursorState() {
  return {
    selected_row: Session.get('selected-row'),
    selected_column: Session.get('selected-column'),
    selected_direction: Session.get('selected-direction'),
    word_across: Session.get('word-across'),
    word_down: Session.get('word-down'),
  };
}

const withCursor = withTracker(() => { return { cursor: cursorState() }; });

const withPuzzle = withTracker(
  ({ puzzleId }) => {
    const puzzle = Puzzles.findOne({ _id: puzzleId }) || { _id: puzzleId, width: 1, height: 1 };
    const squares = Squares.find({ puzzle: puzzleId }, { sort: { row: 1, column: 1 } }).fetch();
    const grid = [];
    let row = [];
    squares.forEach((sq) => {
      if (row.length === 0 || sq.row === row[0].row) {
        row.push(sq);
      } else {
        grid.push(row);
        row = [sq];
      }
    });
    if (row.length > 0) {
      grid.push(row);
    }

    return {
      puzzle,
      squares: grid,
      clues: {
        across: Clues.find({ puzzle: puzzleId, direction: 'across' },
                           { sort: { number: 1 } }).fetch(),
        down: Clues.find({ puzzle: puzzleId, direction: 'down' },
                         { sort: { number: 1 } }).fetch(),
      },
    };
  });

class PuzzleGrid extends React.Component {
  render() {
    const rows = this.props.squares.map((row, i) => {
      const cells = row.map((cell, c) => (
        <PuzzleCellContainer
          key={cell._id}
          square={cell}
          gameId={this.props.gameId}
          onClick={() => this.props.onClickCell({ row: i, column: c })}
        />
      ));
      return (
        <div className="row" key={row[0]._id}>
          {cells}
        </div>
      );
    });

    return (
      <div id="puzzlegrid">
        {rows}
      </div>
    );
  }
}

class PuzzleCell extends React.PureComponent {
  computeClasses() {
    if (this.props.black) {
      return 'filled';
    }
    const classes = {
      circled: this.props.circled,
      selected: this.props.selected,
      inword: this.props.inWord,
      otherword: this.props.otherWord,
      reveal: this.props.fill.reveal,
      wrong: (this.props.fill.checked === 'checking'),
      checked: (this.props.fill.checked === 'checked'),
      correct: (this.props.fill.correct && this.props.letter === this.props.fill.letter),
      pencil: this.props.fill.pencil,
    };

    return classes;
  }

  render() {
    const classes = this.computeClasses();

    return (
      <div role="button" className={classNames('cell', classes)} onClick={this.props.onClick} >
        <div className="circle">
          {this.props.number && (
            <div className="numberlabel">
              {this.props.number}
            </div>
          )}
          <div className="cellbody">
            <div className="fill">
              {this.props.fill.letter}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const withFill = withTracker(
  ({ square, gameId }) => {
    if (!square) {
      return { fill: {} };
    }
    return {
      fill: FillsBySquare.find({ square: square._id, game: gameId }) || {},
    };
  });

const wrapCell = withTracker(
  ({ square, gameId, onClick }) => {
    const cursor = cursorState();
    if (!square) {
      return { };
    }
    const props = {
      gameId,
      number: square.number,
      black: square.black,
      circled: square.circled,
      letter: square.letter,
      selected: (
        cursor.selected_row === square.row &&
          cursor.selected_column === square.column
      ),
      onClick,
    };

    if (props.selected) {
      return props;
    }

    if (cursor.word_across === square.word_across) {
      if (cursor.selected_direction === 'across') {
        props.inWord = true;
      } else {
        props.otherWord = true;
      }
    }

    if (cursor.word_down === square.word_down) {
      if (cursor.selected_direction === 'down') {
        props.inWord = true;
      } else {
        props.otherWord = true;
      }
    }

    return props;
  });

const PuzzleCellContainer = withFill(wrapCell(PuzzleCell));

class Metadata extends React.Component {
  startGame() {
    const id = this.props.puzzle._id;
    Meteor.call('newGame', id, function (error, gotId) {
      if (!error) {
        Router.go('game', { id: gotId });
      }
    });
  }

  render() {
    return (
      <div id="details">
        <div className="title">
          <span className="label label-default">Title</span>
          <span className="value"> {this.props.puzzle.title}</span>
          {(!this.props.gameId) && (
            <span>
              <span className="preview label">Preview</span>
              <button className="btn" onClick={this.startGame.bind(this)}>Start Game</button>
            </span>
          )}
        </div>
        <div className="author">
          <span className="label label-default">By</span>
          <span className="value">{this.props.puzzle.author}</span>
        </div>
      </div>
    );
  }
}

const MetadataContainer = createContainer(({ puzzleId, gameId }) => {
  const puzzle = Puzzles.findOne({ _id: puzzleId }) || { _id: puzzleId };
  return {
    gameId,
    puzzle,
  };
}, Metadata);

class CurrentClue extends React.Component {
  render() {
    const clue = this.props.clue;
    if (!clue) {
      return null;
    }
    return (
      <div id="theclue">
        <span className="label">
          <span className="number">{clue.number}</span>
          <span className="direction"> {clue.direction}</span>
        </span>
        <span className="text">{clue.text}</span>
        <div className="clear" />
      </div>
    );
  }
}

const CurrentClueContainer = createContainer(({ puzzleId }) => {
  const cursor = cursorState();
  const square = SquaresByPosition.find({
    puzzle: puzzleId,
    row: cursor.selected_row,
    column: cursor.selected_column,
  });
  if (!square) {
    return {};
  }
  return {
    clue: Clues.findOne({
      puzzle: puzzleId,
      direction: cursor.selected_direction,
      number: square[`word_${cursor.selected_direction}`],
    }),
  };
}, CurrentClue);

class ClueBox extends React.Component {
  constructor(props) {
    super(props);
    this.onSelect = this.onSelect.bind(this);
  }

  onSelect(e) {
    const target = e.target;
    this.props.onSelect(parseInt(target.dataset.number, 10),
                        target.dataset.direction);
  }

  isSelected(clue, direction) {
    if (this.props.cursor[`word_${direction}`] !== clue.number) {
      return false;
    }
    if (this.props.cursor.selected_direction === direction) {
      return 'selected';
    }
    return 'otherword';
  }

  clueGroup(clues) {
    return (
      clues.map(c => (
        <Clue
          key={c._id}
          number={c.number}
          text={c.text}
          direction={c.direction}
          selected={this.isSelected(c, c.direction)}
          onClick={this.onSelect}
        />
        ))
    );
  }

  render() {
    const acrossClues = this.clueGroup(this.props.clues.across, 'across');
    const downClues = this.clueGroup(this.props.clues.down, 'down');
    return (
      <div id="clues">
        <div className="section across">
          <div className="title"> Across </div>
          <div className="cluelist">
            {acrossClues}
          </div>
        </div>
        <div className="section down">
          <div className="title"> Down </div>
          <div className="cluelist">
            {downClues}
          </div>
        </div>
      </div>
    );
  }
}

const ClueBoxContainer = withCursor(ClueBox);

class Clue extends React.Component {
  render() {
    const classes = classNames('clue', `clue-${this.props.number}`, this.props.selected);
    return (
      <div
        role="button"
        className={classes}
        onClick={this.props.onClick}
        data-number={this.props.number}
        data-direction={this.props.direction}
      >
        {this.props.number}. {this.props.text}
      </div>
    );
  }
}

class Puzzle extends React.Component {
  render() {
    return (
      <div id="puzzle">
        <MetadataContainer
          puzzleId={this.props.puzzleId}
          gameId={this.props.gameId}
        />
        <CurrentClueContainer
          puzzleId={this.props.puzzleId}
        />
        <PuzzleGrid
          gameId={this.props.gameId}
          onClickCell={this.props.onClickCell}
          squares={this.props.squares}
          puzzle={this.props.puzzle}
        />
        <ClueBoxContainer
          onSelect={this.props.onSelect}
          clues={this.props.clues}
        />
        {this.props.gameId &&
          <Sidebar
            doReveal={this.props.doReveal}
            doCheck={this.props.doCheck}
            checkOk={this.props.checkOk}
            gameId={this.props.gameId}
            currentUser={this.props.currentUser}
          />}
      </div>
    );
  }
}

export default withPuzzle(Puzzle);
