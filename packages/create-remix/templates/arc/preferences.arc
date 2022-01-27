# The @env pragma is synced (and overwritten) by running arc env
@env
testing
  NODE_ENV development

staging
  NODE_ENV production

production
  NODE_ENV production
