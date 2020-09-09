let message = "it works!";

export default message;

if (import.meta.hot) {
  import.meta.hot.accept();
}
