`Vary` treats `*` as varying on everything, so `compression()` and `cors()` no longer turn `Vary: *` into an invalid value like `Vary: *, Accept-Encoding`.
