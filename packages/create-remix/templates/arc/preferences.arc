# The @env pragma is synced (and overwritten) by running arc env
@env
testing
  REMIX_ENV development
  NODE_ENV development

staging
  REMIX_ENV production
  NODE_ENV development

production
  REMIX_ENV production
  NODE_ENV development
