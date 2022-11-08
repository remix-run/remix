packages=('testing' 'server-runtime' 'react')
for i in "${packages[@]}"; do
  yalc publish ./build/node_modules/@remix-run/$i
done
