# Multiple Forms in one Route

How to have two or more forms on one Route and have them use the same Action.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/multiple-forms-one-route)

## Example

Depending on the project it is completely reasonable to assume that you may need two or more forms on a page and have those forms use the same Action function. This example demonstrates how to handle that, including handling the response so any messages go to the correct form/area.

## Step 1 - Forms

When building your form you will add a hidden field. The example has two forms and each one has a hidden field.

### Name Form

```js
<input type="hidden" name="formType" value="nameForm" />
```

You can use whatever you want. The name functions as the 'key' later on, while the value is used to determine which form is being submitted.

## Step 2 - Action Function

Your Action function will need to look at submitted forms and see if their key/value matches, and then if so handle processing the submitted values. In the example below we're checking the 'formType' hidden field. If the submitted form was of a formType 'nameForm' then we use the function `processNameForm()` to handle the submission. In this example we just pass the name submitted, but you can pass the whole formData object if you want.

```js
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  if (formData.get("formType") === "nameForm") {
    return processNameForm(formData.get("name"));
  }
  if (formData.get("formType") === "emailForm") {
    return processEmailForm(formData.get("email"));
  }
  return null;
};
```

### Step 3 - Handling Individual Form

At this point we're now handling validating and processing for a specific form. This is where you would save the data to your database, send an email or whatever you need to with the submitted information.

The example returns an object whether its successful or not. This object contains key/value pairs to show which form was submitted and which this response is for.

```js
function processNameForm(name: FormDataEntryValue | null) {
  if (name === "Bad Person") {
    return {
      formType: "nameForm",
      status: "error",
      nameError: true
    };
  }

  return {
    formType: "nameForm",
    status: "success",
    name: name
  };
}
```

### Step 4 - Handling Results

First, grab the results from the action function.

```js
const results = useActionData();
```

Now we will handle error or success message. Generally a successful submission won't simply show the submitted data, but for the sake of this example we're not going to do into anything else.

```js
<h2>Results</h2>

<h3>Success</h3>
<div className="results">
{results?.formType === "nameForm" && results?.status !== "error" ? (
   <>
      <p>{results?.name}</p>
   </>
) : null}
</div>

<h3>Failure</h3>
<div className="results">
{results?.formType === "nameForm" && results?.status === "error" ? (
   <>
      <p className="error">
      {results?.nameError ? "That is not a valid name" : null}
      </p>
   </>
) : null}
</div>
```

## Related Links

[Remix Mutation, Start to finsih](https://remix.run/docs/en/v1/guides/data-writes#remix-mutation-start-to-finish) covers forms in Remix including pending UI.
