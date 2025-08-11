import { useEffect } from "react";
import FallingWords from "./components/FallingWords";

export default function App() {
    useEffect(() => {
        document.documentElement.classList.add("dark");
    }, []);

    return (
        <>
            <div className="min-h-screen  text-neutral-100 flex items-center justify-center ">
                <div className="w-full max-w-4xl ">
                    <div className=" rounded-xl p-5 ">
                        <FallingWords />
                    </div>
                </div>
            </div>
        </>
    );
}
