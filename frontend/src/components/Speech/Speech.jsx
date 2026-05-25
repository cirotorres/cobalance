import { useRef, useState } from "react";

export default function useVoiceInput({ setInput }) {
  const recognitionRef = useRef(null);
  const finalRef = useRef("");         // ✅ no nível do hook, não dentro de funções
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Navegador não suportado");
      return;
    }

    finalRef.current = "";             // ✅ reseta ao começar nova sessão

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalRef.current += text;
        } else {
          interim += text;
        }
      }

      setInput(finalRef.current + interim);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { startListening, stopListening, isListening };
}