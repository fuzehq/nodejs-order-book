/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
import BigNumber from "bignumber.js";
import createRBTree from "functional-red-black-tree";
import { CustomError, ERROR } from "./errors";
import { StopQueue } from "./stopqueue";
import { Side, type StopOrder } from "./types";

export class StopSide {
	private _priceTree: createRBTree.Tree<BigNumber, StopQueue>;
	private _prices: { [key: string]: StopQueue } = {};
	private readonly _side: Side;

	constructor(side: Side) {
		const compare =
			side === Side.SELL
				? (a: BigNumber, b: BigNumber) => a.minus(b).toNumber()
				: (a: BigNumber, b: BigNumber) => b.minus(a).toNumber();
		this._priceTree = createRBTree<BigNumber, StopQueue>(compare);
		this._side = side;
	}

	// appends order to definite price level
	append = (order: StopOrder): StopOrder => {
		const price = order.stopPrice;
		const strPrice = price.toString();
		if (this._prices[strPrice] === undefined) {
			const priceQueue = new StopQueue(price);
			this._prices[strPrice] = priceQueue;
			this._priceTree = this._priceTree.insert(price, priceQueue);
		}
		return this._prices[strPrice].append(order);
	};

	// removes order from definite price level
	remove = (id: string, stopPrice: BigNumber): StopOrder | undefined => {
		const strPrice = stopPrice.toString();
		if (this._prices[strPrice] === undefined) {
			throw CustomError(ERROR.INVALID_PRICE_LEVEL);
		}
		const deletedOrder = this._prices[strPrice].remove(id);
		if (this._prices[strPrice].len() === 0) {
			delete this._prices[strPrice];
			this._priceTree = this._priceTree.remove(stopPrice);
		}
		return deletedOrder;
	};

	removePriceLevel = (priceLevel: BigNumber): void => {
		delete this._prices[priceLevel.toString()];
		this._priceTree = this._priceTree.remove(priceLevel);
	};

	// Get orders queue between two price levels
	between = (priceBefore: BigNumber, marketPrice: BigNumber): StopQueue[] => {
		const queues: StopQueue[] = [];
		let lowerBound = priceBefore;
		let upperBound = marketPrice;
		const highest = BigNumber.max(priceBefore, marketPrice);
		const lowest = BigNumber.min(priceBefore, marketPrice);
		if (this._side === Side.BUY) {
			lowerBound = highest;
			upperBound = lowest.minus(1);
		} else {
			lowerBound = lowest;
			upperBound = highest.plus(1);
		}
		this._priceTree.forEach(
			(price, queue) => {
				if (
					(this._side === Side.BUY && price.isGreaterThanOrEqualTo(lowest)) ||
					(this._side === Side.SELL && price.isLessThanOrEqualTo(highest))
				) {
					queues.push(queue);
				}
			},
			lowerBound, // Inclusive
			upperBound, // Exclusive (so we add +-1 depending on the side)
		);
		return queues;
	};

	priceTree = (): createRBTree.Tree<BigNumber, StopQueue> => {
		return this._priceTree;
	};
	/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
}
