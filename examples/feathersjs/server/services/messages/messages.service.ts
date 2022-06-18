// Initializes the `messages` service on path `/messages`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { Messages } from './messages.class';
import hooks from './messages.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'messages': Messages & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/messages', new Messages(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('messages');

  service.hooks(hooks);
}
