const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({path: 'variables.env'});

const crearToken = (usuario, secreta, expiresIn) => {

    const {id, email, nombre, apellido} = usuario;

    return jwt.sign(
        {id, email, nombre, apellido},
        secreta,
        {expiresIn}
    );
}

//Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                
                const productos = await Producto.find({});

                return productos;

            } catch (error) {
                console.log(error)
            }
        },
        obtenerProducto: async (_, {id}) => {
            //Revisar si el producto existe o no
            const producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            return producto;
        },
        obtenerClientes: async () => {
            try {
                
                const clientes = await Cliente.find({});

                return clientes;

            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
            try {
                
                const clientes = await Cliente.find({vendedor: ctx.usuario.id.toString()});

                return clientes;

            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (_, {id}, ctx) => {
            //Revisar si el cliente existe o no
            const cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error ('Cliente no encontrado');
            }

            //Quien lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error ('No tienes las credenciales');
            }

            return cliente;

        },
        obtenerPedidos: async () => {
            try {
                
                const pedidos = await Pedido.find({});

                return pedidos;

            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                
                const pedidos = await Pedido.find({vendedor: ctx.usuario.id});

                return pedidos;

            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedido: async (_, {id}, ctx) => {
            //Si el pedido existe o no
            const pedido = await Pedido.findById(id);

            if(!pedido) {
                throw new Error('Pedido no encontrado');
            }

            //Solo quien lo creo
            if(pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
               throw new Error('No tienes las credenciales para ver este pedido'); 
            }

            //Retornar el resultado
            return pedido;

        },
        obtenerPedidosEstado: async (_, {estado}, ctx) => {
            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado: estado});

            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match : {estado: "COMPLETADO"}}, //Match filtra y sólo trae lo señalado, en esta caso sólo trae pedidos completados
                { $group : {
                    _id: "$cliente",
                    total: { $sum : "$total"} //Suma todos los registros de cada cliente en especifico
                }},
                {
                    $lookup : { //Va a pasar a la seccion de clientes en la BD para traer los datos de cada usuario especificado arriba
                        from: "clientes",
                        localField: '_id',
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                {
                    $limit: 10 //Trae solo 3
                },
                {
                    $sort : {total: -1}
                }
            ]);

            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match : {estado: "COMPLETADO"}},
                { $group : {
                    _id: "$vendedor",
                    total: { $sum : "$total"}
                }},
                {
                    $lookup : { 
                        from: "usuarios",
                        localField: "_id",
                        foreignField: "_id",
                        as: "vendedor"
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: {total: -1}
                }
            ]);

            return vendedores;
        },
        buscarProducto: async (_, {texto}) => {
            const productos = await Producto.find({$text: { $search: texto}}).limit(10);

            return productos;
        }
    },
    Mutation: {
        nuevoUsuario: async (_, {input}) => {

            const {email, password} = input;

            //Revisar si el usuario ya está registrado
            const existeUsuario = await Usuario.findOne({email});
            
            if(existeUsuario) {
                throw new Error('El usuario ya está registrado');
            }
            //Hashear el password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            //Guardar en la BD
            try {
                const usuario = new Usuario(input);
                usuario.save();

                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        autenticarUsuario: async (_, {input}) => {

            const {email, password} = input;

            //Si el usuario existe
            const existeUsuario = await Usuario.findOne({email});

            if(!existeUsuario) {
                throw new Error('El usuario no existe');
            } else {

                //Revisar si el password es correcto
                const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);
                if(!passwordCorrecto) {
                    throw new Error('El password es incorrecto');
                }

                //Crear el token
                return {
                    token: crearToken(existeUsuario, process.env.SECRETA, '24h')
                }

            }
        },
        nuevoProducto: async (_, {input}) => {
            
            try {
                const producto = new Producto(input);

                //Almacenar en la BD
                const resultado = await producto.save();

                return resultado;
            } catch (error) {
                console.log(error);
            }

        },
        actualizarProducto: async (_, {id, input}) => {
            //Revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            //Guardar en la base de datos
            producto = await Producto.findOneAndUpdate({_id: id}, input, {new: true});//True para que retorne el regitro actualizado, false para retornar la informacion anterior
        
            return producto;
        },
        eliminarProducto: async (_, {id}) => {
            //Revisar si el producto existe o no
            const producto = await Producto.findById(id);

            if(!producto) {
                throw new Error('Producto no encontrado');
            }

            //Eliminar
            await Producto.findOneAndDelete({_id: id});
        
            return "Producto Eliminado";
        },
        nuevoCliente: async (_, {input}, ctx) => {
            //Verificar si el cliente ya está registrado}
            const {email} = input;

            const cliente = await Cliente.findOne({email});

            if(cliente) {
                throw new Error('Ese cliente ya está registrado');
            }
            //Asignar el vendedor
            
            const nuevoCliente = new Cliente(input);
            console.log(ctx);
            nuevoCliente.vendedor = ctx.usuario.id;

            //Guardar en ña BD
            try {

                const resultado = await nuevoCliente.save();

                return resultado;

            } catch (error) {
                console.log(error);
            }

        },
        actualizarCliente: async (_, {id, input}, ctx) => {

            //Verificar si existe
            let cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error('Cliente no encontrado');
            }
            //Verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error ('No tienes las credenciales');
            }

            //Guardar el cliente
            cliente = await Cliente.findOneAndUpdate({_id: id}, input, {new: true});

            return cliente;

        },
        eliminarCliente: async (_, {id}, ctx) => {
            //Verificar si existe
            const cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new Error('Cliente no encontrado');
            }
            //Verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error ('No tienes las credenciales');
            }

            //Eliminar el Cliente
            await Cliente.findOneAndDelete({_id: id});

            return "Cliente eliminado";
        },
        nuevoPedido: async (_, {input}, ctx) => {

            const {cliente} = input;

            //Verificar si el cliente existe o no
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste) {
                throw new Error('Ese cliente no existe');
            }
            //Verificar si el cliente es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error ('No tienes las credenciales');
            }

            //Revisar que el stock esté disponible
            for await (const articulo of input.pedido) {
                const {id} = articulo;

                const producto = await Producto.findById(id);
                if(articulo.cantidad > producto.existencia) {
                    throw new Error(`El articulo ${producto.nombre} excede el stock disponible`);
                } else {
                    //Restar la cantidad a lo disponible
                    producto.existencia = producto.existencia - articulo.cantidad;
                    
                    await producto.save();
                }
            }

            //Crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            //Asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            //Guardaelo en la base de datos
            const resultado = await nuevoPedido.save();

            return resultado;
        },
        actualizarPedido: async (_, {id, input}, ctx) => {
            
            const {cliente} = input;
            
            //Verificar si el pedido existe
            const existePedido = await Pedido.findById(id);
            const existeCliente = await Cliente.findById(cliente);

            if(!existePedido) {
                throw new Error('Ese pedido no existe');
            }
            //Verificar si el cliente existe
            if(!cliente) {
                throw new Error('Ese cliente no existe');
            }

            //Si el cliente y el pedido pertenecen al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id.toString() && existePedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error('No tienes las credenciales para acceder a este contenido');
            }

            //Revisar el stock
            if(input.pedido) {
                for await (const articulo of input.pedido) {
                    const {id} = articulo;

                    const producto = await Producto.findById(id);
                    if(articulo.cantidad > producto.existencia) {
                        throw new Error(`El articulo ${producto.nombre} excede el stock disponible`);
                    } else {
                        //Restar la cantidad a lo disponible
                        producto.existencia = producto.existencia - articulo.cantidad;
                        
                        await producto.save();
                    }
                }
            }

            //Guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
            return resultado;
        },
        eliminarPedido: async (_, {id}, ctx) => {
            //Verificar si el pedido existe
            const pedido = await Pedido.findById(id);

            if(!pedido) {
                throw new Error('Ese pedido no existe');
            }

            //Verificar si el vendedor es quién elimina
            if(pedido.vendedor.toString() !== ctx.usuario.id.toString()) {
                throw new Error ('No cuentas con las credenciales necesarias');
            }

            //Eliminar de la BD
            await Pedido.findOneAndDelete({_id: id});

            return "Pedido Eliminado";
        }
    }
}

module.exports = resolvers;