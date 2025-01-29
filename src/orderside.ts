/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
import BigNumber from "bignumber.js";
import createRBTree from "functional-red-black-tree";
import { CustomError, ERROR } from "./errors";
import { type LimitOrder, OrderFactory } from "./order";
import { OrderQueue } from "./orderqueue";
import { type OrderUpdatePrice, type OrderUpdateSize, Side } from "./types";

export class OrderSide {
	private _priceTree: createRBTree.Tree<BigNumber, OrderQueue>;
	private _prices: { [key: string]: OrderQueue } = {};
	private _volume = BigNumber(0);
	private _total = BigNumber(0);
	private _numOrders = BigNumber(0);
	private _depthSide = BigNumber(0);
	private readonly _side: Side = Side.SELL;

	constructor(side: Side) {
		const compare =
			side === Side.SELL
				? (a: BigNumber, b: BigNumber) => a.minus(b).toNumber()
				: (a: BigNumber, b: BigNumber) => b.minus(a).toNumber();
		this._priceTree = createRBTree<BigNumber, OrderQueue>(compare);
		this._side = side;
	}

	// returns amount of orders
	len = (): BigNumber => {
		return this._numOrders;
	};

	// returns depth of market
	depth = (): BigNumber => {
		return this._depthSide;
	};

	// returns total amount of quantity in side
	volume = (): BigNumber => {
		return this._volume;
	};

	// returns the total (size * price of each price level) in side
	total = (): BigNumber => {
		return this._total;
	};

	// returns the price tree in side
	priceTree = (): createRBTree.Tree<BigNumber, OrderQueue> => {
		return this._priceTree;
	};

	// appends order to definite price level
	append = (order: LimitOrder): LimitOrder => {
		const price = order.price;
		const strPrice = price.toString();
		if (this._prices[strPrice] === undefined) {
			const priceQueue = new OrderQueue(price);
			this._prices[strPrice] = priceQueue;
			this._priceTree = this._priceTree.insert(price, priceQueue);
			this._depthSide = this._depthSide.plus(1);
		}
		this._numOrders = this._numOrders.plus(1);
		this._volume = this._volume.plus(order.size);
		this._total = this._total.plus(order.size.multipliedBy(order.price));
		return this._prices[strPrice].append(order);
	};

	// removes order from definite price level
	remove = (order: LimitOrder): LimitOrder => {
		const price = order.price;
		const strPrice = price.toString();
		if (this._prices[strPrice] === undefined) {
			throw CustomError(ERROR.INVALID_PRICE_LEVEL);
		}
		this._prices[strPrice].remove(order);
		if (this._prices[strPrice].len() === 0) {
			delete this._prices[strPrice];
			this._priceTree = this._priceTree.remove(price);
			this._depthSide = this._depthSide.minus(1);
		}

		this._numOrders = this._numOrders.minus(1);
		this._volume = this._volume.minus(order.size);
		this._total = this._total.minus(order.size.multipliedBy(order.price));
		return order;
	};

	// Update the price of an order and return the order with the updated price
	updateOrderPrice = (
		oldOrder: LimitOrder,
		orderUpdate: OrderUpdatePrice,
	): LimitOrder => {
		this.remove(oldOrder);
		const newOrder = OrderFactory.createOrder({
			...oldOrder.toObject(),
			size: orderUpdate.size !== undefined ? orderUpdate.size : oldOrder.size,
			price: orderUpdate.price,
			time: Date.now(),
		});
		this.append(newOrder);
		return newOrder;
	};

	// Update the price of an order and return the order with the updated price
	updateOrderSize = (
		oldOrder: LimitOrder,
		orderUpdate: OrderUpdateSize,
	): LimitOrder => {
		const newOrderPrice = orderUpdate.price ?? oldOrder.price;
		this._volume = this._volume.plus(orderUpdate.size.minus(oldOrder.size));

		const v1 = orderUpdate.size.multipliedBy(newOrderPrice);
		const v2 = oldOrder.size.multipliedBy(oldOrder.price);
		this._total = this._total.plus(v1.minus(v2));

		this._prices[oldOrder.price.toString()].updateOrderSize(
			oldOrder,
			orderUpdate.size,
		);
		return oldOrder;
	};

	// returns max level of price
	maxPriceQueue = (): OrderQueue | undefined => {
		if (this._depthSide.isGreaterThan(0)) {
			const max =
				this._side === Side.SELL ? this._priceTree.end : this._priceTree.begin;
			return max.value;
		}

		return;
	};

	// returns min level of price
	minPriceQueue = (): OrderQueue | undefined => {
		if (this._depthSide.isGreaterThan(0)) {
			const min =
				this._side === Side.SELL ? this._priceTree.begin : this._priceTree.end;
			return min.value;
		}

		return;
	};

	// returns nearest OrderQueue with price less than given
	lowerThan = (price: BigNumber): OrderQueue | undefined => {
		const node =
			this._side === Side.SELL
				? this._priceTree.lt(price)
				: this._priceTree.gt(price);
		return node.value;
	};

	// returns nearest OrderQueue with price greater than given
	greaterThan = (price: BigNumber): OrderQueue | undefined => {
		const node =
			this._side === Side.SELL
				? this._priceTree.gt(price)
				: this._priceTree.lt(price);
		return node.value;
	};

	// returns all orders
	orders = (): LimitOrder[] => {
		let orders: LimitOrder[] = [];
		for (const price in this._prices) {
			const allOrders = this._prices[price].toArray();
			orders = orders.concat(allOrders);
		}
		return orders;
	};

	toString = (): string => {
		let s = "";
		let level = this.maxPriceQueue();
		while (level !== undefined) {
			const volume: string = level.volume().toString();
			s += `\n${level.price().toNumber()} -> ${volume}`;
			level = this.lowerThan(level.price());
		}
		return s;
	};
	/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
}
