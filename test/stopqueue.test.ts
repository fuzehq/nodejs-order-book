import assert from "node:assert/strict";
import test from "node:test";
import BigNumber from "bignumber.js";
import { OrderFactory, StopLimitOrder } from "../src/order";
import { StopQueue } from "../src/stopqueue";
import { OrderType, Side, TimeInForce } from "../src/types";

void test("it should append/remove orders from queue", () => {
	const price = BigNumber(100);
	const stopPrice = BigNumber(90);
	const oq = new StopQueue(price);
	// Test edge case where head is undefined (queue is empty)
	assert.equal(oq.removeFromHead(), undefined);

	// Test append()
	const order1 = OrderFactory.createOrder({
		type: OrderType.STOP_LIMIT,
		id: "order1",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		stopPrice,
		timeInForce: TimeInForce.GTC,
	});
	const order2 = OrderFactory.createOrder({
		type: OrderType.STOP_LIMIT,
		id: "order2",
		side: Side.SELL,
		size: BigNumber(5),
		price,
		stopPrice,
		timeInForce: TimeInForce.GTC,
	});

	const head = oq.append(order1);
	const tail = oq.append(order2);

	assert.equal(head instanceof StopLimitOrder, true);
	assert.equal(tail instanceof StopLimitOrder, true);
	assert.deepStrictEqual(head, order1);
	assert.deepStrictEqual(tail, order2);
	assert.equal(oq.len(), 2);

	const order3 = OrderFactory.createOrder({
		type: OrderType.STOP_LIMIT,
		id: "order3",
		side: Side.SELL,
		size: BigNumber(10),
		price,
		stopPrice,
		timeInForce: TimeInForce.GTC,
	});
	oq.append(order3);
	assert.equal(oq.len(), 3);

	const order4 = OrderFactory.createOrder({
		type: OrderType.STOP_LIMIT,
		id: "order4",
		side: Side.SELL,
		size: BigNumber(10),
		price,
		stopPrice,
		timeInForce: TimeInForce.GTC,
	});
	oq.append(order4);
	assert.equal(oq.len(), 4);

	// Test toArray()
	const orders = oq.toArray();
	assert.deepStrictEqual(orders[0].toObject(), order1.toObject());
	assert.deepStrictEqual(orders[1].toObject(), order2.toObject());
	assert.deepStrictEqual(orders[2].toObject(), order3.toObject());
	assert.deepStrictEqual(orders[3].toObject(), order4.toObject());

	// Test remove()
	assert.deepStrictEqual(oq.removeFromHead(), order1);
	assert.deepStrictEqual(oq.remove(order4.id), order4);
	assert.equal(oq.len(), 2);

	assert.deepStrictEqual(oq.removeFromHead(), order2);
	assert.equal(oq.len(), 1);

	assert.equal(oq.remove("fake-id"), undefined);
	assert.equal(oq.len(), 1);

	assert.deepStrictEqual(oq.remove(order3.id), order3);
	assert.equal(oq.len(), 0);
});
