import React from 'react';

interface PriceSummaryProps {
  currencySymbol?: string;
  pricePerPerson?: number;
  numberOfPeople?: number;
  hourlyRate?: number;
  durationHours?: number;
  durationDays?: number;
  discount?: number;
  total: number;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  currencySymbol = '₹',
  pricePerPerson,
  numberOfPeople,
  hourlyRate,
  durationHours,
  durationDays,
  discount = 0,
  total,
}) => {
  const fmt = (n: number) => `${currencySymbol}${Number(n).toFixed(2)}`;
  const subtotal = total + discount;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2.5 text-[15px]">
      <h4 className="text-[17px] font-bold text-gray-900">Price Summary</h4>
      {pricePerPerson !== undefined && (
        <p className="flex justify-between text-gray-600">
          <span>Price per person</span>
          <strong className="text-gray-900">{fmt(pricePerPerson)}</strong>
        </p>
      )}
      {numberOfPeople !== undefined && (
        <p className="flex justify-between text-gray-600">
          <span>Number of people</span>
          <strong className="text-gray-900">{numberOfPeople}</strong>
        </p>
      )}
      {hourlyRate !== undefined && (
        <p className="flex justify-between text-gray-600">
          <span>Hourly rate</span>
          <strong className="text-gray-900">{fmt(hourlyRate)}</strong>
        </p>
      )}
      {durationHours !== undefined && (
        <p className="flex justify-between text-gray-600">
          <span>Duration</span>
          <strong className="text-gray-900">{durationHours} hour{durationHours === 1 ? '' : 's'}</strong>
        </p>
      )}
      {durationDays !== undefined && (
        <p className="flex justify-between text-gray-600">
          <span>Number of days</span>
          <strong className="text-gray-900">{durationDays} day{durationDays === 1 ? '' : 's'}</strong>
        </p>
      )}
      <p className="flex justify-between text-gray-600">
        <span>Subtotal</span>
        <strong className="text-gray-900">{fmt(subtotal)}</strong>
      </p>
      <p className="flex justify-between text-gray-600">
        <span>Discount</span>
        <strong className="text-gray-900">{fmt(discount)}</strong>
      </p>
      <p className="flex justify-between pt-2 border-t border-gray-200 text-[16px] font-bold">
        <span>Total</span>
        <span className="text-[#007bc0]">{fmt(total)}</span>
      </p>
    </div>
  );
};

export default PriceSummary;
