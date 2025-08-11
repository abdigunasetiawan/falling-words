import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Play, Pause, RotateCcw, XCircle, Maximize2, Minimize2 } from "lucide-react";

type WordInstance = {
    id: string;
    text: string;
    x: number;
    y: number;
    speed: number;
};

const difficulties = {
    easy: { spawnMs: 2000, baseSpeed: 60 },
    medium: { spawnMs: 1400, baseSpeed: 110 },
    hard: { spawnMs: 900, baseSpeed: 170 },
} as const;

const wordData = {
    all: [],
    animals: ["cat", "dog", "lion", "tiger", "elephant", "bear", "wolf", "eagle", "shark", "whale", "giraffe", "zebra", "panda", "kangaroo", "penguin", "dolphin", "leopard", "crocodile", "fox", "owl"],
    food: ["pizza", "burger", "pasta", "rice", "bread", "cake", "chocolate", "sushi", "noodles", "steak", "sandwich", "salad", "icecream", "taco", "burrito", "dumpling", "cheese", "butter", "jam", "cookie"],
    college: ["campus", "lecture", "exam", "thesis", "student", "library", "assignment", "professor", "classroom", "research", "seminar", "presentation", "dormitory", "scholarship", "whiteboard", "notebook", "curriculum", "graduation", "syllabus", "internship"],
    computer: ["keyboard", "mouse", "monitor", "laptop", "code", "binary", "server", "database", "python", "javascript", "algorithm", "compiler", "debug", "network", "html", "css", "router", "firewall", "cloud", "storage"],
    sports: ["football", "basketball", "tennis", "golf", "swimming", "running", "cycling", "baseball", "boxing", "cricket", "volleyball", "hockey", "rugby", "karate", "judo", "surfing", "skating", "skiing", "archery", "fencing"],
    music: ["guitar", "piano", "violin", "drum", "flute", "song", "melody", "lyrics", "concert", "band", "microphone", "speaker", "note", "chord", "harmony", "solo", "orchestra", "album", "genre", "tempo"],
    movies: ["actor", "director", "cinema", "screen", "scene", "action", "comedy", "drama", "thriller", "animation", "script", "camera", "editing", "blockbuster", "premiere", "sequel", "trailer", "costume", "soundtrack", "studio"],
    science: ["atom", "molecule", "gravity", "energy", "planet", "galaxy", "neutron", "electron", "biology", "chemistry", "physics", "microscope", "telescope", "experiment", "equation", "theory", "quantum", "genetics", "ecology", "volcano"],
    geography: ["mountain", "river", "desert", "ocean", "island", "forest", "valley", "canyon", "waterfall", "volcano", "continent", "country", "city", "village", "glacier", "bay", "peninsula", "plateau", "reef", "delta"],
    transportation: ["car", "bus", "train", "bicycle", "motorcycle", "airplane", "ship", "subway", "truck", "tram", "scooter", "helicopter", "rocket", "yacht", "canoe", "kayak", "ferry", "taxi", "van", "metro"],
    colors: ["red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "black", "white", "gray", "cyan", "magenta", "maroon", "beige", "turquoise", "gold", "silver", "navy", "olive"],
    jobs: ["teacher", "doctor", "nurse", "engineer", "farmer", "pilot", "chef", "artist", "writer", "scientist", "lawyer", "police", "firefighter", "dentist", "driver", "mechanic", "actor", "singer", "designer", "programmer"],
};

// Merge all into "all"
wordData.all = Object.values(wordData).flat().filter(Boolean) as string[];

function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function ShortcutBadge({ keys }: { keys: string[] }) {
    return (
        <span className="ml-2 hidden sm:inline-flex items-center gap-1">
            {keys.map((k, i) => (
                <kbd key={i} className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800 border border-neutral-700 rounded">
                    {k}
                </kbd>
            ))}
        </span>
    );
}

export default function FallingWords() {
    const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
    const [theme, setTheme] = useState<keyof typeof wordData>("all");
    const [active, setActive] = useState<WordInstance[]>([]);
    const activeRef = useRef<WordInstance[]>([]);
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [playing, setPlaying] = useState(false);
    const [paused, setPaused] = useState(false);
    const [highScore, setHighScore] = useState<number>(Number(localStorage.getItem("fw_high") || 0));
    const [showGameOver, setShowGameOver] = useState(false);
    const [typedCorrect, setTypedCorrect] = useState<string[]>([]);
    const [typedMissed, setTypedMissed] = useState<string[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const playRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const spawnTimerRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const gameStartTimeRef = useRef<number>(0);

    const focusInput = () => setTimeout(() => inputRef.current?.focus(), 50);

    const clearTimers = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
        rafRef.current = null;
        spawnTimerRef.current = null;
    };

    const flushActiveToState = () => setActive([...activeRef.current]);

    useEffect(() => {
        localStorage.setItem("fw_high", String(highScore));
    }, [highScore]);

    useEffect(() => {
        const onFull = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
            if (document.fullscreenElement) focusInput();
        };
        document.addEventListener("fullscreenchange", onFull);
        return () => document.removeEventListener("fullscreenchange", onFull);
    }, []);

    // Game loop
    useEffect(() => {
        if (!playing || paused) return;
        lastTimeRef.current = performance.now();

        const loop = (time: number) => {
            const last = lastTimeRef.current ?? time;
            const dt = (time - last) / 1000;
            lastTimeRef.current = time;

            const containerHeight = playRef.current?.clientHeight ?? 300;
            const prev = activeRef.current;
            const nextArr: WordInstance[] = [];
            let missedCount = 0;
            const missedWords: string[] = [];

            for (let i = 0; i < prev.length; i++) {
                const w = prev[i];
                const newY = w.y + w.speed * dt;
                if (newY > containerHeight - 24) {
                    missedCount++;
                    missedWords.push(w.text);
                } else {
                    nextArr.push({ ...w, y: newY });
                }
            }

            if (missedCount > 0) {
                setTypedMissed((prev) => [...prev, ...missedWords]);
                setLives((prevLives) => Math.max(0, prevLives - missedCount));
            }

            activeRef.current = nextArr;
            flushActiveToState();
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current!);
    }, [playing, paused]);

    // Spawn words
    useEffect(() => {
        if (!playing || paused) return;

        const spawn = () => {
            const elapsed = (performance.now() - gameStartTimeRef.current) / 1000;
            const spawnMsBase = difficulties[difficulty].spawnMs;
            const minSpawnMs = 400;
            const spawnMs = Math.max(minSpawnMs, spawnMsBase - elapsed * 10);

            const list = wordData[theme] ?? wordData.all;
            const text = list[Math.floor(Math.random() * list.length)];
            const id = String(Math.random()).slice(2);
            const x = rand(5, 95);
            const base = difficulties[difficulty].baseSpeed;
            const speed = base + Math.random() * 40 + elapsed * 2;
            activeRef.current.push({ id, text, x, y: 0, speed });
            flushActiveToState();

            if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = window.setInterval(spawn, spawnMs);
        };

        spawnTimerRef.current = window.setInterval(spawn, difficulties[difficulty].spawnMs);
        return () => clearInterval(spawnTimerRef.current!);
    }, [playing, paused, difficulty, theme]);

    useEffect(() => {
        if (lives <= 0) {
            clearTimers();
            setPlaying(false);
            activeRef.current = [];
            flushActiveToState();
            setShowGameOver(true);
            setHighScore((prevHigh) => (score > prevHigh ? score : prevHigh));

            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }, [lives, score]);

    // Shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.code === "KeyS") {
                e.preventDefault();
                toggleStartStop();
                focusInput();
            }
            if (e.ctrlKey && e.altKey && e.code === "KeyP") {
                e.preventDefault();
                if (playing) {
                    setPaused((p) => !p);
                    focusInput();
                }
            }
            if (e.ctrlKey && e.altKey && e.code === "KeyF") {
                e.preventDefault();
                toggleFullscreen();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [playing, paused]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!playing || paused) return;
        const rawVal = e.target.value;
        setInput(rawVal);
        const trimmed = rawVal.trim();
        if (!trimmed) return;

        const found = activeRef.current.find((w) => w.text === trimmed);
        if (!found) return;

        setTypedCorrect((prev) => [...prev, found.text]);
        setScore((s) => s + Math.max(10, found.text.length * 10));
        activeRef.current = activeRef.current.filter((w) => w.id !== found.id);
        flushActiveToState();
        setInput("");
    };

    const startGame = () => {
        clearTimers();
        activeRef.current = [];
        flushActiveToState();
        setScore(0);
        setLives(3);
        setTypedCorrect([]);
        setTypedMissed([]);
        setInput("");
        setShowGameOver(false);
        lastTimeRef.current = null;
        gameStartTimeRef.current = performance.now();
        setPaused(false);
        setPlaying(true);
        focusInput();
    };

    const stopGame = () => {
        clearTimers();
        setPlaying(false);
        setPaused(false);
        activeRef.current = [];
        flushActiveToState();
    };

    const resumeGame = () => {
        setPaused(false);
        focusInput();
    };

    const toggleStartStop = () => (!playing ? startGame() : stopGame());

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && playRef.current) {
                await playRef.current.requestFullscreen();
                focusInput();
            } else {
                await document.exitFullscreen();
            }
        } catch {}
    };

    return (
        <>
            <Card className="text-neutral-100 bg-transparent">
                <CardHeader>
                    <CardTitle className="flex gap-x-4 items-center">
                        {/* Logo SVG */}
                        <svg fill="none" height="48" viewBox="0 0 44 48" width="44" xmlns="http://www.w3.org/2000/svg">
                            <g fill="#fff">
                                <path d="m16 8 5.0912 10.9088 10.9088 5.0912-10.9088 5.0912-5.0912 10.9088-5.0912-10.9088-10.9088-5.0912 10.9088-5.0912z" />
                                <path d="m20.0469 31.3286 6.3539-1.0932 3.6 9.7646 3.6-9.7646 10.2565 1.7646-6.6564-8 6.6564-8-10.2565 1.7646-3.6-9.7646-3.6 9.7646-6.3539-1.0932 1.0442 2.2374 10.9088 5.0912-10.9088 5.0912z" opacity=".5" />
                            </g>
                        </svg>
                        <span className="text-lg sm:text-xl font-extrabold">Falling Words</span>
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Stats + Controls */}
                    <div className="flex flex-wrap gap-2 justify-between text-sm sm:text-base">
                        <div className="space-x-4 flex items-center flex-wrap">
                            <span>Score: {score}</span>
                            <span>Lives: {lives}</span>
                            <span>High Score: {highScore}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    toggleStartStop();
                                    focusInput();
                                }}
                                size="sm"
                            >
                                {playing ? <XCircle className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                                {playing ? "Stop" : "Start"}
                                <ShortcutBadge keys={["Ctrl", "Alt", "S"]} />
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    paused ? resumeGame() : setPaused(true);
                                    focusInput();
                                }}
                                size="sm"
                                disabled={!playing}
                            >
                                {paused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                                {paused ? "Resume" : "Pause"}
                                <ShortcutBadge keys={["Ctrl", "Alt", "P"]} />
                            </Button>
                            <Button variant="outline" onClick={toggleFullscreen} size="sm">
                                {isFullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                <ShortcutBadge keys={["Ctrl", "Alt", "F"]} />
                            </Button>
                        </div>
                    </div>

                    {/* Game Area */}
                    <div ref={playRef} className="relative border border-neutral-800 rounded-lg h-64 sm:h-72 overflow-hidden bg-neutral-950/20" style={isFullscreen ? { height: "100vh" } : undefined}>
                        {active.map((w) => (
                            <div key={w.id} style={{ left: `${w.x}%`, top: `${w.y}px` }} className="absolute -translate-x-1/2 px-2 sm:px-3 py-1 bg-violet-600 rounded text-xs sm:text-sm font-medium shadow">
                                {w.text}
                            </div>
                        ))}
                        {isFullscreen && (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-11/12">
                                <Input ref={inputRef as any} value={input} onChange={handleInput} placeholder={playing ? (paused ? "Paused" : "Type here...") : "Press Start to play"} className="bg-neutral-800 border-neutral-700 text-neutral-100 w-full" disabled={!playing || paused} />
                            </div>
                        )}
                    </div>

                    {!isFullscreen && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input ref={inputRef as any} value={input} onChange={handleInput} placeholder={playing ? (paused ? "Paused" : "Type here...") : "Press Start to play"} className="bg-neutral-800 border-neutral-700 text-neutral-100 flex-1" disabled={!playing || paused} />
                            <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                                <SelectTrigger className="w-full sm:w-32 bg-neutral-800 border-neutral-700 text-neutral-100">
                                    <SelectValue placeholder="Difficulty" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                                <SelectTrigger className="w-full sm:w-40 bg-neutral-800 border-neutral-700 text-neutral-100">
                                    <SelectValue placeholder="Theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(wordData).map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Game Over Dialog */}
            <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
                <DialogContent className="bg-neutral-900 text-neutral-100 border-neutral-700 w-[90%] sm:w-full max-w-lg p-4 sm:p-6 rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Game Over</DialogTitle>
                        <DialogDescription>Your final score is:</DialogDescription>
                    </DialogHeader>
                    <div className="text-3xl font-bold text-center py-4">{score}</div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm">
                        <div className="flex-1">
                            <div className="font-semibold mb-1">Correct Words</div>
                            <div className="p-2 border border-green-800 rounded bg-green-950/30 min-h-[80px] overflow-auto">{typedCorrect.join(", ") || "None"}</div>
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold mb-1">Missed Words</div>
                            <div className="p-2 border border-red-800 rounded bg-red-950/30 min-h-[80px] overflow-auto">{typedMissed.join(", ") || "None"}</div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={startGame}>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Play Again
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
