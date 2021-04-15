const {ApolloServer} = require('apollo-server');

const typeDefs = require('./db/schema'); 
const resolvers = require('./db/resolvers');

const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');

require('dotenv').config({path: 'variables.env'});

//Conectar a la BD
conectarDB();

//Servidor
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => {

        const token = req.headers['authorization'] || '';

        if(token) {
            try {
                
                const usuario = jwt.verify(token, process.env.SECRETA);

                return {
                    usuario
                };

            } catch (error) {
                console.log('Hubo un error ' + error);
            }
        }
        
    }
});

//Arrancar el servidor
server.listen().then( ({url}) => {
    console.log(`Servidor listo en la url: ${url}`);
} );