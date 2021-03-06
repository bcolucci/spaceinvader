'use strict';

const Immutable = require('immutable');

const DEFAULT_FIELD_WIDTH = 500;
const DEFAULT_FIELD_HEIGHT = 900;

const BACKGROUND_MOVE_STEP = 3;
const SHIP_MOVE_STEP = 15;

const DEFAULT_SHIP_WIDTH = 48;
const DEFAULT_SHIP_HEIGHT = 48;
const DEFAULT_SHIP_X = Math.floor(DEFAULT_FIELD_WIDTH/2 - DEFAULT_SHIP_WIDTH/2);
const DEFAULT_SHIP_Y = Math.floor(3.7 * DEFAULT_FIELD_HEIGHT/4 - DEFAULT_SHIP_HEIGHT/2);

const DEFAULT_METEOR_WIDTH = 32;
const DEFAULT_METEOR_HEIGHT = 32;
const METEOR_GENERATION_PROB = 0.08;
const DEFAULT_METEOR_Y = -DEFAULT_METEOR_HEIGHT;

const MIN_METEORS = 30;
const MAX_METEORS = 100;

const DEFAULT_METEOR_MOVE_STEP = 4;
const FAST_METEOR_PROB = 0.40;
const FAST_METEOR_MOVE_STEP = 10;

const DEFAULT_FIRE_WIDTH = 32;
const FIRE_MOVE_STEP = 15;

const COLLISION_PADDING = 5;

const SCORE_METEOR_MULTIPLIER = 1;
const SCORE_METEOR_FAST_MULTIPLIER = 10;

const METEOR_HITS = 5;
const FAST_METEOR_HITS = 2;

const Meteor = Immutable.Record({
  width: DEFAULT_METEOR_WIDTH,
  height: DEFAULT_METEOR_HEIGHT,
  fast: false,
  hits: 0,
  x: 0,
  y: DEFAULT_METEOR_Y
});

const Field = Immutable.Record({
  width: DEFAULT_FIELD_WIDTH,
  height: DEFAULT_FIELD_HEIGHT,
  yPosition: 0
});

const ShipFire = Immutable.Record({ x: 0, y: 0 , width:32});

const Ship = Immutable.Record({
  width: DEFAULT_SHIP_WIDTH,
  height: DEFAULT_SHIP_HEIGHT,
  x: DEFAULT_SHIP_X,
  y: DEFAULT_SHIP_Y
});

const GameState = Immutable.Record({
  frameNumber: 1,
  score: 0,
  level: 0,
  field: new Field,
  ship: new Ship,
  meteors: [],
  fires: [],
  paused: false,
  actions: []
});

const Action = {
  DO_NOTHING: 'do_nothing',
  MOVE_LEFT: 'move_left',
  MOVE_RIGHT: 'move_right',
  FIRE: 'fire',
  PAUSE: 'pause'
};

Action.fromKeyCode = keyCode => {
  if (keyCode === 'Escape') return Action.PAUSE;
  if (keyCode === 'ArrowLeft') return Action.MOVE_LEFT;
  if (keyCode === 'ArrowRight') return Action.MOVE_RIGHT;
  if (keyCode === 'Space') return Action.FIRE;
  return Action.DO_NOTHING;
};

//TODO use functional.js
Action.isNot = excludedKeyCode => keyCode => keyCode !== excludedKeyCode;

const Game = function () {

  const initialState = new GameState;

  const MIN_SHIP_X = 0;
  const MAX_SHIP_X = initialState.field.width - initialState.ship.width;

  const meteorIntoTheField = meteor => meteor.y <= initialState.field.height;
  const fireIntoTheField = fire => fire.y >= 0;

  const moveMeteor = meteor => meteor.set('y', meteor.y + (meteor.fast ? FAST_METEOR_MOVE_STEP : DEFAULT_METEOR_MOVE_STEP));
  const moveFire = fire => fire.set('y', fire.y - FIRE_MOVE_STEP);

  const manageMeteors = state => {
    let meteors = state.meteors.filter(meteorIntoTheField).map(moveMeteor);
    if (state.meteors.length < MIN_METEORS || (Math.random() <= METEOR_GENERATION_PROB && state.meteors.length < MAX_METEORS)) {
      const meteor = new Meteor({
        x: Math.floor(state.field.width * Math.random()),
        fast: Math.random() <= FAST_METEOR_PROB
      });
      meteors.push(meteor);
    }
    return meteors;
  };

  const addFire = state => new ShipFire({
    x: state.ship.x + Math.floor(state.ship.width - DEFAULT_FIRE_WIDTH)/2,
    y: state.ship.y - Math.floor(state.ship.height/2)
  });

  const inRange = (r1, r2) => v => v >= r1 && v <= r2;

  const isMeteorDestroyed = meteor => meteor.hits >= (meteor.fast ? FAST_METEOR_HITS : METEOR_HITS);

  const manageCollisions = (ship, fires, meteors) => {
    let score = 0;
    const firesToRemove = [];
    const hitMeteors = meteors.map(meteor => {
      const meteorYBase = meteor.y + meteor.height;
      if (meteorYBase >= ship.y) return meteor;
      let mappedMeteor = meteor;
      const inXRange = inRange(meteor.x - COLLISION_PADDING, meteor.x + meteor.width + COLLISION_PADDING);
      const inYRange = y => y <= (meteor.y + meteor.height + COLLISION_PADDING);
      fires.forEach(fire => {
        if (!inXRange(fire.x+Math.floor(fire.width/2)) || !inYRange(fire.y)) return;
        mappedMeteor = meteor.set('hits', meteor.hits + 1);
        firesToRemove.push(fire);
        if (!isMeteorDestroyed(mappedMeteor)) return;
        score += meteor.fast ? SCORE_METEOR_FAST_MULTIPLIER : SCORE_METEOR_MULTIPLIER;
        mappedMeteor = null;
      });
      return mappedMeteor;
    });
    return {
      score: score,
      meteors: hitMeteors.filter(m => m !== null),
      fires: fires.filter(fire => firesToRemove.indexOf(fire) === -1)
    };
  };

  const calculateLevel = score => {
    //TODO
    return 1;
  };

  const GameFrame = (actions, previousState) => {

    const _previousState = previousState;

    if (actions.indexOf(Action.PAUSE) === -1 && _previousState.paused)
      return _previousState;

    const currentState = _previousState
      .set('field', _previousState.field.set('yPosition', _previousState.field.yPosition + BACKGROUND_MOVE_STEP))
      .set('frameNumber', _previousState.frameNumber + 1);

    if (actions.indexOf(Action.PAUSE) > -1)
      return new GameState(currentState.set('paused', !currentState.paused));

    let fires = currentState.fires.filter(fireIntoTheField).map(moveFire);
    let meteors = manageMeteors(currentState);

    const collisionResults = manageCollisions(currentState.ship, fires, meteors);
    fires = collisionResults.fires;
    meteors = collisionResults.meteors;

    const score = _previousState.score + Math.floor(_previousState.frameNumber / 10) + collisionResults.score;

    let ship = currentState.ship;
    actions.forEach(action => {
      if (action === Action.MOVE_LEFT)
        ship = ship.set('x', Math.max(MIN_SHIP_X, ship.x - SHIP_MOVE_STEP));
      else if (action === Action.MOVE_RIGHT)
        ship = ship.set('x', Math.min(MAX_SHIP_X, ship.x + SHIP_MOVE_STEP));
      else if (action === Action.FIRE)
        fires = fires.concat(addFire(currentState));
    });

    return new GameState(
      currentState
        .set('score', score)
        .set('level', calculateLevel(score))
        .set('ship', ship)
        .set('fires', fires)
        .set('meteors', meteors)
        .set('actions', actions)
    );
  };

  return {
    nextFrame: GameFrame,
    initialState: initialState
  };
};

module.exports = { Action, Game };
