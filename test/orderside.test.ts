import assert from "node:assert/strict";
import test from "node:test";
import BigNumber from "bignumber.js";
import { ErrorCodes, ErrorMessages } from "../src/errors";
import { OrderFactory } from "../src/order";
import { OrderSide } from "../src/orderside";
import { OrderType, Side, TimeInForce } from "../src/types";

void test("it should append/update/remove orders from queue on BUY side", () => {
	const os = new OrderSide(Side.BUY);
	const order1 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order1",
		side: Side.BUY,
		size: BigNumber(5),
		price: BigNumber(10),
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});
	const order2 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order2",
		side: Side.BUY,
		size: BigNumber(5),
		price: BigNumber(20),
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});

	assert.equal(os.minPriceQueue() === undefined, true);
	assert.equal(os.maxPriceQueue() === undefined, true);

	os.append(order1);
	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.volume().toNumber(), 5);
	assert.equal(
		os.total().toNumber(),
		order1.price.multipliedBy(order1.size).toNumber(),
	);
	assert.equal(os.priceTree().length, 1);

	os.append(order2);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.volume().toNumber(), 10);
	assert.equal(
		os.total().toNumber(),
		order1.price
			.multipliedBy(order1.size)
			.plus(order2.price.multipliedBy(order2.size))
			.toNumber(),
	);
	assert.equal(os.len().toNumber(), 2);
	assert.equal(os.priceTree().length, 2);
	assert.deepStrictEqual(os.orders()[0], order1);
	assert.deepStrictEqual(os.orders()[1], order2);

	assert.equal(os.lowerThan(BigNumber(21))?.price().toNumber(), 20);
	assert.equal(os.lowerThan(BigNumber(19))?.price().toNumber(), 10);
	assert.equal(os.lowerThan(BigNumber(9)) === undefined, true);

	assert.equal(os.greaterThan(BigNumber(9))?.price().toNumber(), 10);
	assert.equal(os.greaterThan(BigNumber(19))?.price().toNumber(), 20);
	assert.equal(os.greaterThan(BigNumber(21)) === undefined, true);

	assert.equal(os.toString(), "\n20 -> 5\n10 -> 5");

	// Update order size and passing a price
	os.updateOrderSize(order1, {
		size: BigNumber(10),
		price: order1.price,
	});

	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	assert.equal(os.orders()[0].id, order1.id);
	assert.equal(os.orders()[0].size.toNumber(), 10);
	assert.deepStrictEqual(os.orders()[1], order2);
	assert.equal(os.toString(), "\n20 -> 5\n10 -> 10");

	// Update order size without passing price, so the old order price will be used
	os.updateOrderSize(order1, { size: BigNumber(5) });

	assert.equal(os.volume().toNumber(), 10);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	assert.equal(os.orders()[0].id, order1.id);
	assert.equal(os.orders()[0].size.toNumber(), 5);
	assert.deepStrictEqual(os.orders()[1], order2);
	assert.equal(os.toString(), "\n20 -> 5\n10 -> 5");

	// When price is updated a new order will be created, so we can't match entire object, only properties
	// Update price of order1 < price order2
	let updatedOrder = os.updateOrderPrice(order1, {
		size: BigNumber(10),
		price: BigNumber(15),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	let updateOrder1 = os.orders()[0];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 15);
	assert.deepStrictEqual(os.orders()[1], order2);
	assert.equal(os.toString(), "\n20 -> 5\n15 -> 10");

	// Test for error when price level not exists
	try {
		// order1 has been replaced whit updateOrder, so trying to update order1 will throw an error of type INVALID_PRICE_LEVEL
		os.updateOrderPrice(order1, {
			size: BigNumber(10),
			price: BigNumber(20),
		});
	} catch (error) {
		assert.equal(error?.message, ErrorMessages.INVALID_PRICE_LEVEL);
		assert.equal(error?.code, ErrorCodes.INVALID_PRICE_LEVEL);
	}

	// Update price of order1 == price order2, without providind size (the original order size is used)
	// we have to type ignore here because we don't want to pass the size,
	// so the size from the oldOrder will be used instead
	updatedOrder = os.updateOrderPrice(updatedOrder, {
		price: BigNumber(20),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 1);
	assert.equal(os.len().toNumber(), 2);
	assert.deepStrictEqual(os.orders()[0], order2);
	updateOrder1 = os.orders()[1];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 20);
	assert.equal(os.toString(), "\n20 -> 15");

	// Update price of order1 > price order2
	updatedOrder = os.updateOrderPrice(updatedOrder, {
		size: BigNumber(10),
		price: BigNumber(25),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	assert.deepStrictEqual(os.orders()[0], order2);
	updateOrder1 = os.orders()[1];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 25);
	assert.equal(os.toString(), "\n25 -> 10\n20 -> 5");

	// @ts-expect-error _priceTree is private property
	os._priceTree.values.reduce((previousPrice, curr) => {
		// BUY side are in descending order bigger to lower
		// @ts-expect-error _price is private property
		const currPrice = curr._price;
		assert.equal(currPrice.isLessThan(previousPrice), true);
		return currPrice;
	}, Number.POSITIVE_INFINITY);

	// Remove the updated order
	os.remove(updatedOrder);

	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.depth().toNumber(), 1);
	assert.equal(os.volume().toNumber(), 5);
	assert.equal(os.len().toNumber(), 1);
	assert.deepStrictEqual(os.orders()[0], order2);

	assert.equal(os.toString(), "\n20 -> 5");

	// Remove the remaining order
	os.remove(order2);

	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.depth().toNumber(), 0);
	assert.equal(os.volume().toNumber(), 0);
	assert.equal(os.len().toNumber(), 0);
	assert.equal(os.toString(), "");
});
void test("it should append/update/remove orders from queue on SELL side", () => {
	const os = new OrderSide(Side.SELL);
	const order1 = OrderFactory.createOrder({
		type: OrderType.LIMIT,
		id: "order1",
		side: Side.SELL,
		size: BigNumber(5),
		price: BigNumber(10),
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
		price: BigNumber(20),
		origSize: BigNumber(5),
		timeInForce: TimeInForce.GTC,
		makerQty: BigNumber(5),
		takerQty: BigNumber(0),
	});

	assert.equal(os.minPriceQueue() === undefined, true);
	assert.equal(os.maxPriceQueue() === undefined, true);

	os.append(order1);

	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.volume().toNumber(), 5);
	assert.equal(
		os.total().toNumber(),
		order1.price.multipliedBy(order1.size).toNumber(),
	);
	assert.equal(os.priceTree().length, 1);

	os.append(order2);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.volume().toNumber(), 10);
	assert.equal(
		os.total().toNumber(),
		order1.price
			.multipliedBy(order1.size)
			.plus(order2.price.multipliedBy(order2.size))
			.toNumber(),
	);
	assert.equal(os.len().toNumber(), 2);
	assert.equal(os.priceTree().length, 2);
	assert.deepStrictEqual(os.orders()[0], order1);
	assert.deepStrictEqual(os.orders()[1], order2);

	assert.equal(os.lowerThan(BigNumber(21))?.price().toNumber(), 20);
	assert.equal(os.lowerThan(BigNumber(19))?.price().toNumber(), 10);
	assert.equal(os.lowerThan(BigNumber(9)) === undefined, true);

	assert.equal(os.greaterThan(BigNumber(9))?.price().toNumber(), 10);
	assert.equal(os.greaterThan(BigNumber(19))?.price().toNumber(), 20);
	assert.equal(os.greaterThan(BigNumber(21)) === undefined, true);

	assert.equal(os.toString(), "\n20 -> 5\n10 -> 5");

	// Update order size and passing a price
	os.updateOrderSize(order1, {
		size: BigNumber(10),
		price: order1.price,
	});

	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	assert.equal(os.orders()[0].id, order1.id);
	assert.equal(os.orders()[0].size.toNumber(), 10);
	assert.deepStrictEqual(os.orders()[1], order2);
	assert.equal(os.toString(), "\n20 -> 5\n10 -> 10");

	// When price is updated a new order will be created, so we can't match entire object, only properties
	// Update price of order1 < price order2
	let updatedOrder = os.updateOrderPrice(order1, {
		size: BigNumber(10),
		price: BigNumber(15),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	let updateOrder1 = os.orders()[0];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 15);
	assert.deepStrictEqual(os.orders()[1], order2);
	assert.equal(os.toString(), "\n20 -> 5\n15 -> 10");

	// Test for error when price level not exists
	try {
		// order1 has been replaced whit updateOrder, so trying to update order1 will throw an error of type INVALID_PRICE_LEVEL
		os.updateOrderPrice(order1, {
			size: BigNumber(10),
			price: BigNumber(20),
		});
	} catch (error) {
		assert.equal(error?.message, ErrorMessages.INVALID_PRICE_LEVEL);
		assert.equal(error?.code, ErrorCodes.INVALID_PRICE_LEVEL);
	}

	// Update price of order1 == price order2
	// we have to type ignore here because we don't want to pass the size,
	// so the size from the oldOrder will be used instead
	updatedOrder = os.updateOrderPrice(updatedOrder, {
		size: updatedOrder.size,
		price: BigNumber(20),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 1);
	assert.equal(os.len().toNumber(), 2);
	assert.deepStrictEqual(os.orders()[0], order2);
	updateOrder1 = os.orders()[1];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 20);
	assert.equal(os.toString(), "\n20 -> 15");

	// Update price of order1 > price order2
	updatedOrder = os.updateOrderPrice(updatedOrder, {
		size: BigNumber(10),
		price: BigNumber(25),
	});
	assert.equal(os.volume().toNumber(), 15);
	assert.equal(os.depth().toNumber(), 2);
	assert.equal(os.len().toNumber(), 2);
	assert.deepStrictEqual(os.orders()[0], order2);
	updateOrder1 = os.orders()[1];
	assert.equal(updateOrder1.size.toNumber(), 10);
	assert.equal(updateOrder1.price.toNumber(), 25);
	assert.equal(os.toString(), "\n25 -> 10\n20 -> 5");

	// @ts-expect-error _priceTree is private property
	os._priceTree.values.reduce((previousPrice, curr) => {
		// SELL side are in ascending order lower to bigger
		// @ts-expect-error _price is private property
		const currPrice = curr._price;
		assert.equal(currPrice.isGreaterThan(previousPrice), true);
		return currPrice;
	}, 0);

	// Remove the updated order
	os.remove(updatedOrder);

	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.depth().toNumber(), 1);
	assert.equal(os.volume().toNumber(), 5);
	assert.equal(os.len().toNumber(), 1);
	assert.deepStrictEqual(os.orders()[0], order2);

	assert.equal(os.toString(), "\n20 -> 5");

	// Remove the remaining order
	os.remove(order2);

	assert.equal(os.maxPriceQueue(), os.minPriceQueue());
	assert.equal(os.depth().toNumber(), 0);
	assert.equal(os.volume().toNumber(), 0);
	assert.equal(os.len().toNumber(), 0);
	assert.equal(os.toString(), "");
});
