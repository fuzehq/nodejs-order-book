/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
import type BigNumber from "bignumber.js";
import type { StopQueue } from "./stopqueue";
import { StopSide } from "./stopside";
import { type IStopOrder, OrderType, Side, type StopOrder } from "./types";

export class StopBook {
	private readonly bids: StopSide;
	private readonly asks: StopSide;

	constructor() {
		this.bids = new StopSide(Side.BUY);
		this.asks = new StopSide(Side.SELL);
	}

	add = (order: StopOrder): void => {
		const stopSide = order.side === Side.BUY ? this.bids : this.asks;
		stopSide.append(order);
	};

	remove = (
		side: Side,
		id: string,
		stopPrice: BigNumber,
	): StopOrder | undefined => {
		const stopSide = side === Side.BUY ? this.bids : this.asks;
		return stopSide.remove(id, stopPrice);
	};

	removePriceLevel = (side: Side, priceLevel: BigNumber): void => {
		const stopSide = side === Side.BUY ? this.bids : this.asks;
		stopSide.removePriceLevel(priceLevel);
	};

	getConditionalOrders = (
		side: Side,
		priceBefore: BigNumber,
		marketPrice: BigNumber,
	): StopQueue[] => {
		const stopSide = side === Side.BUY ? this.bids : this.asks;
		return stopSide.between(priceBefore, marketPrice);
	};

	/**
	 * Stop-Limit Order:
	 *    Buy: marketPrice < stopPrice <= price
	 *    Sell: marketPrice > stopPrice >= price
	 * Stop-Market Order:
	 *    Buy: marketPrice < stopPrice
	 *    Sell: marketPrice > stopPrice
	 */
	validConditionalOrder = (
		marketPrice: BigNumber,
		order: StopOrder,
	): boolean => {
		let response = false;
		const { type, side, stopPrice } = order;
		if (type === OrderType.STOP_LIMIT) {
			// Buy: marketPrice < stopPrice <= price
			if (
				side === Side.BUY &&
				marketPrice.isLessThan(stopPrice) &&
				stopPrice.isLessThanOrEqualTo(order.price)
			) {
				response = true;
			}
			// Sell: marketPrice > stopPrice >= price
			if (
				side === Side.SELL &&
				marketPrice.isGreaterThan(stopPrice) &&
				stopPrice.isGreaterThanOrEqualTo(order.price)
			) {
				response = true;
			}
		} else {
			// Buy: marketPrice < stopPrice
			if (side === Side.BUY && marketPrice.isLessThan(stopPrice))
				response = true;
			// Sell: marketPrice > stopPrice
			if (side === Side.SELL && marketPrice.isGreaterThan(stopPrice))
				response = true;
		}
		return response;
	};

	snapshot = () => {
		const bids: Array<{ price: BigNumber; orders: IStopOrder[] }> = [];
		const asks: Array<{ price: BigNumber; orders: IStopOrder[] }> = [];
		this.bids.priceTree().forEach((price: BigNumber, orders: StopQueue) => {
			bids.push({ price, orders: orders.toArray().map((o) => o.toObject()) });
		});
		this.asks.priceTree().forEach((price: BigNumber, orders: StopQueue) => {
			asks.push({ price, orders: orders.toArray().map((o) => o.toObject()) });
		});
		return { bids, asks };
	};
	/* node:coverage ignore next - Don't know why first and last line of each file count as uncovered */
}
