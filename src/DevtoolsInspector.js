import React, { Component, PropTypes } from 'react';
import { createStylingFromTheme } from './createStylingFromTheme';
import shouldPureComponentUpdate from 'react-pure-render/function';
import ActionList from './ActionList';
import ActionPreview from './ActionPreview';
import getInspectedState from './getInspectedState';
import DiffPatcher from './DiffPatcher';
import { getBase16Theme } from 'react-base16-styling';
import * as base16Themes from 'redux-devtools-themes';
import * as inspectorThemes from './themes';
import { reducer, updateMonitorState } from './redux';

function getCurrentActionId(props) {
  const state = props.monitorState;
  const lastActionId = props.stagedActionIds[props.stagedActionIds.length - 1];
  return state.selectedActionId === null ? lastActionId : state.selectedActionId;
}

function createState(props) {
  const { supportImmutable, computedStates, actionsById: actions, monitorState: state } = props;
  const currentActionId = getCurrentActionId(props, state);
  const currentAction = actions[currentActionId] && actions[currentActionId].action;

  const fromState = currentActionId > 0 ? computedStates[currentActionId - 1] : null;
  const toState = computedStates[currentActionId];

  const fromInspectedState = fromState &&
    getInspectedState(fromState.state, state.inspectedStatePath, supportImmutable);
  const toInspectedState =
    toState && getInspectedState(toState.state, state.inspectedStatePath, supportImmutable);
  const delta = fromState && toState && DiffPatcher.diff(
    fromInspectedState,
    toInspectedState
  );

  return {
    delta,
    currentActionId,
    nextState: toState && getInspectedState(toState.state, state.inspectedStatePath, false),
    action: getInspectedState(currentAction, state.inspectedActionPath, false)
  };
}

function createThemeState(props) {
  const base16Theme = getBase16Theme(props.theme, { ...base16Themes, ...inspectorThemes });
  const styling = createStylingFromTheme(base16Theme || props.theme, props.isLightTheme);

  return { base16Theme, styling };
}

export default class DevtoolsInspector extends Component {
  state = {
    isWideLayout: false,
    selectedActionId: null,
    inspectedActionPath: [],
    inspectedStatePath: [],
    tab: 'Diff',
    isLightTheme: true
  };

  static propTypes = {
    dispatch: PropTypes.func,
    computedStates: PropTypes.array,
    stagedActionIds: PropTypes.array,
    actionsById: PropTypes.object,
    currentStateIndex: PropTypes.number,
    monitorState: PropTypes.shape({
      initialScrollTop: PropTypes.number
    }),
    preserveScrollTop: PropTypes.bool,
    stagedActions: PropTypes.array,
    select: PropTypes.func.isRequired,
    theme: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string
    ]),
    supportImmutable: PropTypes.bool
  };

  static update = reducer;

  static defaultProps = {
    select: (state) => state,
    supportImmutable: false
  };

  shouldComponentUpdate = shouldPureComponentUpdate;

  componentWillMount() {
    this.props.dispatch(updateMonitorState({
      ...createState(this.props),
      ...createThemeState(this.props)
    }));
  }

  componentDidMount() {
    this.updateSizeMode();
    this.updateSizeTimeout = window.setInterval(this.updateSizeMode.bind(this), 150);
  }

  componentWillUnmount() {
    window.clearTimeout(this.updateSizeTimeout);
  }

  updateSizeMode() {
    const isWideLayout = this.refs.inspector.offsetWidth > 500;
    if (isWideLayout !== this.props.monitorState.isWideLayout) {
      this.props.dispatch(updateMonitorState({ isWideLayout }));
    }
  }

  componentWillUpdate(nextProps) {
    let state = nextProps.monitorState;

    if (this.props.computedStates !== nextProps.computedStates ||
      getCurrentActionId(this.props) !== getCurrentActionId(nextProps) ||
      this.props.monitorState.inspectedStatePath !== nextProps.monitorState.inspectedStatePath ||
      this.props.monitorState.inspectedActionPath !== nextProps.monitorState.inspectedActionPath) {

      state = { ...state, ...createState(nextProps) };
    }

    if (this.props.theme !== nextProps.theme ||
      this.props.isLightTheme !== nextProps.isLightTheme) {

      state = { ...state, ...createThemeState(nextProps) };
    }

    if (state !== nextProps.monitorState) {
      nextProps.dispatch(updateMonitorState(state));
    }
  }

  render() {
    const { stagedActionIds: actionIds, actionsById: actions, monitorState } = this.props;
    const { isWideLayout, selectedActionId, nextState, action,
            searchValue, tab, delta, base16Theme, styling } = monitorState;
    const inspectedPathType = tab === 'Action' ? 'inspectedActionPath' : 'inspectedStatePath';

    return (
      <div key='inspector'
           ref='inspector'
           {...styling(['inspector', isWideLayout && 'inspectorWide'], isWideLayout)}>
        <ActionList {...{ actions, actionIds, isWideLayout, searchValue, selectedActionId }}
                    styling={styling}
                    onSearch={this.handleSearch}
                    onSelect={this.handleSelectAction} />
        <ActionPreview {...{ base16Theme, tab, delta, nextState, action }}
                       styling={styling}
                       onInspectPath={this.handleInspectPath.bind(this, inspectedPathType)}
                       inspectedPath={monitorState[inspectedPathType]}
                       onSelectTab={this.handleSelectTab} />
      </div>
    );
  }

  handleSearch = val => {
    this.props.dispatch(updateMonitorState({ searchValue: val }));
  };

  handleSelectAction = actionId => {
    const { monitorState: { selectedActionId } } = this.props;

    this.props.dispatch(updateMonitorState({
      selectedActionId: actionId === selectedActionId ? null : actionId
    }));
  };

  handleInspectPath = (pathType, path) => {
    this.props.dispatch(updateMonitorState({ [pathType]: path }));
  };

  handleSelectTab = tab => {
    this.props.dispatch(updateMonitorState({ tab }));
  };
}
