import assert from "node:assert/strict";
import test from "node:test";
import BigNumber from "bignumber.js";
import { LimitOrder, OrderFactory } from "../src/order";
import { OrderQueue } from "../src/orderqueue";
import { OrderType, Side, TimeInForce } from "../src/types";

void test("it should append/update/remove orders from queue", () => {
	const price = BigNumber(100);
	const oq = new OrderQueue(price);
	const order1 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order1",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});
	const order2 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order2",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});

	const head = oq.append(order1);
	const tail = oq.append(order2);

	assert.equal(head instanceof LimitOrder, true);
	assert.equal(tail instanceof LimitOrder, true);
	assert.deepStrictEqual(head, order1);
	assert.deepStrictEqual(tail, order2);
	assert.equal(oq.volume().toNumber(), 10);
	assert.equal(oq.len(), 2);
	assert.equal(oq.price().toNumber(), price.toNumber());
	const orders = oq.toArray();
	assert.deepStrictEqual(orders[0].toObject(), order1.toObject());
	assert.deepStrictEqual(orders[1].toObject(), order2.toObject());

	const order3 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order3",
		side: Side.SELL,
		size: BigNumber(10),
		price,
		origSize: BigNumber(10),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(10),
		takerQty: BigNumber(0),
	});

	// Test update. Number of orders is always 2
	oq.update(head, order3);

	assert.equal(oq.volume().toNumber(), 15);
	assert.equal(oq.len(), 2);

	const head2 = oq.head();
	const tail2 = oq.tail();
	assert.deepStrictEqual(head2, order3);
	assert.deepStrictEqual(tail2, order2);

	oq.remove(order3);

	// order2 is head and tail
	const head3 = oq.head();
	const tail3 = oq.tail();
	assert.equal(oq.len(), 1);
	assert.equal(oq.volume().toNumber(), 5);
	assert.deepStrictEqual(head3, order2);
	assert.deepStrictEqual(tail3, order2);
});

void test("it should update order size and the volume", () => {
	const price = BigNumber(100);
	const oq = new OrderQueue(price);
	const order1 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order1",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});
	const order2 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order2",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});

	oq.append(order1);
	oq.append(order2);

	assert.equal(oq.volume().toNumber(), 10);

	const newSize = BigNumber(10);
	oq.updateOrderSize(order1, newSize);

	assert.equal(oq.volume().toNumber(), 15);
	assert.equal(order1.size.toNumber(), newSize.toNumber());
	// Original size should not be changed
	assert.equal(order1.origSize.toNumber(), 5);
});
