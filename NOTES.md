/bakery => <BakeryHome><Index /></BakeryHome>
/bakery/ => <BakeryHome><Index /></BakeryHome>
/bakery/not-found => Error!
/bakery/cookies => <BakeryHome><Layout><Cookies /></Layout></BakeryHome>
/bakery/muffins => <BakeryHome><Muffins /></BakeryHome>

```tsx
const USERS_PATH = '/users';
const USER_PATH = '/users/:userId';

let routes = createRoutesFromArray([
  {
    path: USERS_PATH,
    element: <Users />,
    children: [
      {
        path: USER_PATH,
        element: <UserProfile />
      }
    ]
  }
])

<Routes>
  <Route path="/bakery" element={<BakeryHome />}>
    <Route path="/" element={<Index />} />
    <Route path="*" element={<NotFound />}>

    <Route element={<Layout />}>
      <Route path="cookies" element={<Cookies />} />
      <Route path="/cinnamon-rolls" element={<CinnamonRolls />} />
    </Route>

    <Route path="muffins" element={<Muffins />} />
    <Route path="/cupcakes" element={<Cupcakes />} />
  </Route>
</Routes>

<Routes>
  <Route path="/bakery" element={<BakeryHome />}>
    <Route index element={<Index />} />
    <Route path="*" element={<NotFound />}>

    <Route element={<Layout />}>
      <Route path="cookies" element={<Cookies />} />
      <Route path="/bakery/cinnamon-rolls" element={<CinnamonRolls />} />
    </Route>

    <Route path="muffins" element={<Muffins />} />
    <Route path="/bakery/cupcakes" element={<Cupcakes />} />
  </Route>
</Routes>
```
