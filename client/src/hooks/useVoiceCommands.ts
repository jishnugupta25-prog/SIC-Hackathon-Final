import { useEffect, useRef, useState } from 'react';

export interface VoiceCommandConfig {
  keywords: string[];
  onCommandDetected: (keyword: string) => void;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onError?: (error: string) => void;
}

export function useVoiceCommands(config: VoiceCommandConfig) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      config.onError?.('Voice commands not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configuration
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Support Indian English

    recognition.onstart = () => {
      setIsListening(true);
      config.onListeningStart?.();
      console.log('[Voice Commands] Listening started');
    };

    recognition.onresult = (event: any) => {
      let transcript = '';

      // Collect results from all events
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const isFinal = event.results[i].isFinal;
        const result = event.results[i][0].transcript.toLowerCase().trim();
        transcript += result;

        if (isFinal) {
          console.log(`[Voice Commands] Detected: "${result}"`);

          // Check if any keyword is in the transcript
          for (const keyword of config.keywords) {
            if (transcript.includes(keyword.toLowerCase())) {
              console.log(`[Voice Commands] ✓ Keyword matched: "${keyword}"`);
              config.onCommandDetected(keyword);
              break;
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice Commands] Error:', event.error);
      config.onError?.(`Voice recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      config.onListeningEnd?.();
      console.log('[Voice Commands] Listening stopped');
      
      // Auto restart if we're meant to be listening
      // This helps maintain continuous listening
      if (isListening) {
        try {
          recognition.start();
        } catch (error) {
          console.log('[Voice Commands] Auto-restart failed (likely already listening)');
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [config]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.log('[Voice Commands] Start failed:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.log('[Voice Commands] Stop failed:', error);
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
  };
}
