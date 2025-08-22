"use client";

import {useState} from 'react';

export default function SignInPage() {
    const[email,setEmail] = useState("");

    return (
        <main className="mx-auto max-w-md p-6">
            <h1 className = "text-2xl font-semibold mb-4">Sign In</h1>
            <form action="/api/auth/signin/email" method = "POST" className="space-y-4">
                <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange = {(e) => setEmail(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
                <button className= "w-full rounded bg-black text-white py-2">
                    Email me a magic link!
                </button>
            </form>
            <p className="text-sm text-gray-500 mt-4">
                In development, the email appears in your Mailtrap inbox.
            </p>
        </main>
    )
}