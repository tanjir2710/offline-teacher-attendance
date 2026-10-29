import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'DIU Exam Duty · Fall 2026',description:'Your invigilation duties, in one place. DIU CSE Midterm, Fall 2026.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
