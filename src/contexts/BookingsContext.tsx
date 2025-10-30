import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Booking {
  id: string;
  date: string;
  time: string;
  court: string;
  sport: string;
  player: string;
  email: string;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  payment: string;
  source: string;
  amount: string;
  duration: number;
  notes?: string;
}

interface BookingsContextType {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id'>) => void;
}

const BookingsContext = createContext<BookingsContextType | undefined>(undefined);

export const BookingsProvider = ({ children }: { children: ReactNode }) => {
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: "BK001",
      date: "2025-01-15",
      time: "09:00",
      court: "Court 1",
      sport: "Tennis",
      player: "John Smith",
      email: "john@example.com",
      status: "confirmed",
      payment: "Paid",
      source: "PlayPal App",
      amount: "฿800",
      duration: 60,
    },
    {
      id: "BK002",
      date: "2025-01-15",
      time: "10:30",
      court: "Court 2",
      sport: "Badminton",
      player: "Sarah Lee",
      email: "sarah@example.com",
      status: "pending",
      payment: "Pending",
      source: "Direct",
      amount: "฿600",
      duration: 60,
    },
    {
      id: "BK003",
      date: "2025-01-15",
      time: "14:00",
      court: "Court 1",
      sport: "Tennis",
      player: "Mike Johnson",
      email: "mike@example.com",
      status: "paid",
      payment: "Paid",
      source: "API",
      amount: "฿1,200",
      duration: 90,
    },
  ]);

  const addBooking = (booking: Omit<Booking, 'id'>) => {
    const newBooking: Booking = {
      ...booking,
      id: `BK${String(bookings.length + 1).padStart(3, '0')}`,
    };
    setBookings(prev => [newBooking, ...prev]);
  };

  return (
    <BookingsContext.Provider value={{ bookings, addBooking }}>
      {children}
    </BookingsContext.Provider>
  );
};

export const useBookings = () => {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within BookingsProvider');
  }
  return context;
};
