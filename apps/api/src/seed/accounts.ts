/**
 * Demo accounts. They are seeded only when demo sign-in is on, because anyone may sign
 * in to them. The people are invented.
 */
import type { UserRole } from '@unun/core';

export type AccountSeed = {
  phone: string;
  name: string;
  role: UserRole;
  /** Slugs of the kitchens an owner runs. */
  kitchens?: string[];
  address?: { label: string; area: string; line: string };
};

export const demoAccountSeeds: AccountSeed[] = [
  {
    phone: '01700000006',
    name: 'Rahim Uddin',
    role: 'customer',
    address: { label: 'Home', area: 'dhanmondi', line: 'House 5, Road 27' },
  },
  { phone: '01700000002', name: 'Rahima Khatun', role: 'owner', kitchens: ['dum-ghor'] },
  {
    phone: '01700000003',
    name: 'Kamal Hossain',
    role: 'owner',
    kitchens: ['koylar-aanch'],
  },
  { phone: '01700000004', name: 'Jamal Mia', role: 'rider' },
  { phone: '01700000005', name: 'Sumon Ali', role: 'rider' },
  { phone: '01700000001', name: 'Nusrat Jahan', role: 'admin' },
];

/** Customers who exist so the seeded order history has someone to belong to. */
export const pastCustomerSeeds: Array<{ phone: string; name: string }> = [
  { phone: '01711000101', name: 'Farhana Akter' },
  { phone: '01711000102', name: 'Tanvir Ahmed' },
  { phone: '01811000103', name: 'Sadia Islam' },
  { phone: '01911000104', name: 'Mahmudul Hasan' },
  { phone: '01611000105', name: 'Nabila Rahman' },
  { phone: '01511000106', name: 'Arif Chowdhury' },
  { phone: '01711000107', name: 'Shirin Sultana' },
  { phone: '01811000108', name: 'Imran Kabir' },
  { phone: '01711000109', name: 'Tasnim Jahan' },
  { phone: '01911000110', name: 'Rakib Hasan' },
  { phone: '01811000111', name: 'Mehnaz Karim' },
  { phone: '01611000112', name: 'Shafiqul Islam' },
  { phone: '01711000113', name: 'Lamia Haque' },
  { phone: '01511000114', name: 'Asif Mahmud' },
  { phone: '01911000115', name: 'Rumana Begum' },
  { phone: '01811000116', name: 'Fahim Reza' },
  { phone: '01711000117', name: 'Mitu Das' },
  { phone: '01311000118', name: 'Sabbir Rahman' },
  { phone: '01411000119', name: 'Jannatul Ferdous' },
  { phone: '01711000120', name: 'Anik Barua' },
  { phone: '01811000121', name: 'Priya Saha' },
  { phone: '01911000122', name: 'Zahid Hossain' },
  { phone: '01611000123', name: 'Sumaiya Noor' },
  { phone: '01711000124', name: 'Naimur Rashid' },
];

/** The demo customer a visitor signs in as. They have a history too, so it is not empty. */
export const demoCustomerPhone = '01700000006';
