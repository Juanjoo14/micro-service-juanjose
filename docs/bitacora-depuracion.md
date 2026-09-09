# Bitacora de depuracion

## La API de pedidos aceptaba `amount`

- Sintoma: el cliente podia enviar un importe arbitrario.
- Causa: shopping recibia y persistia `amount` directamente.
- Correccion: shopping consulta products, calcula `price * quantity` y rechaza productos no disponibles.

## El gateway enriquecia ordenes

- Sintoma: `/profile` llamaba a products aunque shopping ya posee las ordenes.
- Causa: la composicion estaba duplicando la responsabilidad de enriquecimiento.
- Correccion: shopping agrega `currentProduct` y gateway solo compone customers y shopping.

## Servicios con puertos intercambiados

- Sintoma: los compose no respetaban el puerto asignado por dominio.
- Causa: la configuracion original se copio desde el orden de creacion.
- Correccion: gateway 8000, customers 8001, products 8002 y shopping 8003.
