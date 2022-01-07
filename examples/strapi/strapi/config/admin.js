module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', '2bcab5ec860df5c21e01d60e43bf58d6'),
  },
});
