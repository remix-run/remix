export class RemixFormData implements FormData {
  private _params: URLSearchParams;

  constructor(body: string) {
    this._params = new URLSearchParams(body);
  }

  append(name: string, value: string | Blob, fileName?: string): void {
    throw new Error("formData.append is not supported on the server.");
  }
  delete(name: string): void {
    throw new Error("formData.delete is not supported on the server.");
  }
  get(name: string): FormDataEntryValue | null {
    return this._params.get(name);
  }
  getAll(name: string): FormDataEntryValue[] {
    return this._params.getAll(name);
  }
  has(name: string): boolean {
    return this._params.has(name);
  }
  set(name: string, value: string | Blob, fileName?: string): void {
    throw new Error("formData.set is not supported on the server.");
  }
  forEach(
    callbackfn: (
      value: FormDataEntryValue,
      key: string,
      parent: FormData
    ) => void,
    thisArg?: any
  ): void {
    this._params.forEach(callbackfn, thisArg);
  }
}
