// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/lib/component.js
function createElement(type, props, ...children) {
  if (children.length > 0) {
    props.children = children;
  }
  return { type, props, $rmx: true };
}
function createComponent(config) {
  let taskQueue = [];
  let renderCtrl = new AbortController;
  let connectedCtrl = new AbortController;
  let contextValue = undefined;
  let getContent = null;
  let scheduleUpdate = () => {
    throw new Error("scheduleUpdate not implemented");
  };
  let context = {
    set: (value) => {
      contextValue = value;
    },
    get: (type) => {
      return config.getContext(type);
    }
  };
  let handle = {
    id: config.id,
    update: (task) => {
      if (task)
        taskQueue.push(task);
      scheduleUpdate();
    },
    queueTask: (task) => {
      taskQueue.push(task);
    },
    raise: config.raise,
    frame: config.frame,
    context,
    signal: connectedCtrl.signal
  };
  function dequeueTasks() {
    return taskQueue.splice(0, taskQueue.length).map((task) => task.bind(handle, renderCtrl.signal));
  }
  function render(props) {
    if (connectedCtrl.signal.aborted) {
      console.warn("render called after component was removed, potential application memory leak");
      return [null, []];
    }
    renderCtrl.abort();
    renderCtrl = new AbortController;
    if (!getContent) {
      let result = config.type.call(handle, props);
      if (typeof result === "function") {
        getContent = (props2) => result.call(handle, props2, renderCtrl.signal);
      } else {
        getContent = (props2) => config.type.call(handle, props2);
      }
    }
    let node = getContent(props);
    return [node, dequeueTasks()];
  }
  function remove() {
    connectedCtrl.abort();
    return dequeueTasks();
  }
  function setScheduleUpdate(_scheduleUpdate) {
    scheduleUpdate = _scheduleUpdate;
  }
  function getContextValue() {
    return contextValue;
  }
  return { render, remove, setScheduleUpdate, frame: config.frame, getContextValue };
}
function Frame(_) {
  return null;
}
function Fragment(_) {
  return null;
}
function Catch(_) {
  return null;
}
function createFrameHandle(def) {
  return Object.assign(new EventTarget, {
    src: "/",
    replace: notImplemented("replace not implemented"),
    reload: notImplemented("reload not implemented")
  }, def);
}
function notImplemented(msg) {
  return () => {
    throw new Error(msg);
  };
}

export { createElement, createComponent, Frame, Fragment, Catch, createFrameHandle };

//# debugId=E6CB69CEF99B889D64756E2164756E21
