import app from "./app";

let port = process.env.PORT || 3000;

app.listen(port, () => {
  if (process.env.NODE_ENV === "production") {
    console.log(`Remix server started on port ${port}`);
  } else {
    console.log(`Remix server started at http://localhost:${port}`);
  }
});
