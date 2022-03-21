// https://gist.github.com/yyx990803/f61f347b6892078c40a9e8e77b9bd984

let pendingAssertions;

exports.prompt = (prompts) => {
  if (!pendingAssertions) {
    throw new Error(
      `inquirer was mocked and used without pending assertions: ${prompts}`
    );
  }

  let answers = {};
  let skipped = 0;
  prompts.forEach((prompt, i) => {
    if (prompt.when && !prompt.when(answers)) {
      skipped++;
      return;
    }

    let setValue = (val) => {
      if (prompt.validate) {
        let res = prompt.validate(val);
        if (res !== true) {
          throw new Error(`validation failed for prompt: ${prompt}`);
        }
      }
      answers[prompt.name] = prompt.filter ? prompt.filter(val) : val;
    };

    let a = pendingAssertions[i - skipped];

    if (a.message) {
      let message =
        typeof prompt.message === "function"
          ? prompt.message(answers)
          : prompt.message;
      expect(message).toContain(a.message);
    }

    if (a.choices) {
      expect(prompt.choices.length).toBe(a.choices.length);
      a.choices.forEach((c, i) => {
        let expected = a.choices[i];
        if (expected) {
          expect(prompt.choices[i].name).toContain(expected);
        }
      });
    }

    if (a.input != null) {
      expect(prompt.type).toBe("input");
      setValue(a.input);
    }

    if (a.choose != null) {
      expect(prompt.type).toBe("list");
      setValue(prompt.choices[a.choose].value);
    }

    if (a.check != null) {
      expect(prompt.type).toBe("checkbox");
      setValue(a.check.map((i) => prompt.choices[i].value));
    }

    if (a.confirm != null) {
      expect(prompt.type).toBe("confirm");
      setValue(a.confirm);
    }

    if (a.useDefault) {
      expect("default" in prompt).toBe(true);
      setValue(
        typeof prompt.default === "function"
          ? prompt.default(answers)
          : prompt.default
      );
    }
  });

  expect(prompts.length).toBe(pendingAssertions.length + skipped);
  pendingAssertions = null;

  return Promise.resolve(answers);
};

exports.expectPrompts = (assertions) => {
  pendingAssertions = assertions;
};
