Async `on()` handlers and `queueTask()` callbacks no longer produce unhandled promise rejections when their cancellation signal is aborted as the runtime observes a returned rejection. This includes requests aborted when an event handler runs again, a component renders again, or its element is removed. Other observed failures are reported through a new unhandled promise rejection, including failures from returned thenables. To handle a failure, catch it inside the callback or return the handled promise chain. Component tasks without render cancellation tracking retain their existing return-value behavior. Pending tasks flushed on component removal receive an aborted cancellation signal even if they omit the parameter.

Return the handled promise chain when a callback delegates its error handling:

```diff
 on('click', () => {
   let result = save()
-  result.catch(showToast)
-  return result
+  return result.catch(showToast)
 })
```
