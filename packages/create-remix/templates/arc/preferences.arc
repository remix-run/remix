# The @env pragma is synced (and overwritten) by running arc env
@env
testing
  REMIX_ENV development

staging
  REMIX_ENV production

production
  REMIX_ENV production
