declare const jestFn: Function;

// jestFn will be available in the test env as a global variable
export const jsx = (type: any, props: any) => jestFn(type, props);
