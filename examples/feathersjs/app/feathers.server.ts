import io from 'socket.io-client';
import feather from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';


const socket = io('http://localhost:3000');

const server = feather();

server.configure(socketio(socket));

export { server };