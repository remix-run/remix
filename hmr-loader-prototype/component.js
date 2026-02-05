// component.js - Sample component for server-side HMR testing

export function Greeting(handle) {
  return (props) => {
    return `Module graph stays fresh during HMR! Time: ${new Date().toLocaleTimeString()}`
  }
}
