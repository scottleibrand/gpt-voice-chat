const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const toggleSpeechButton = document.getElementById("toggleSpeechButton");
const output = document.getElementById("output");
let userIsSpeaking = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if ("speechSynthesis" in window && SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  let speakText = false;
  let apiKey;
  let conversationHistory = [
    {
      role: 'system',
      content:
        'You are a helpful assistant accessed via a voice interface from Apple devices. Your responses will be read aloud to the user. Please keep your responses brief. If you have a long response, ask the user if they want you to continue. If the user’s input doesn’t quite make sense, it might have been dictated incorrectly: feel free to guess what they really said.',
    },
  ];

  async function preprocessUserMessage(apiKey, message) {
    const preprocessMessage = {
      role: 'user',
      content: 'Please indicate whether the following message appears to be a valid instruction/request/question, or whether it appears to be incomplete. Respond only with the word "complete" or "incomplete". If uncertain, answer "complete"',
    };
    const conversationHistory = [preprocessMessage, { role: 'user', content: message }];

    const response = await getAssistantResponse(apiKey, conversationHistory);
    return response.toLowerCase().includes('incomplete');
  }

  recognition.addEventListener('result', async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const confidence = event.results[event.results.length - 1][0].confidence;

    if (event.results[event.results.length - 1].isFinal) {
      const apiKey = document.getElementById('api_key').value;

      if (apiKey) {
        handleRecognizedSpeech(apiKey, transcript);
      } else {
        output.innerHTML += 'Error: Please enter your OpenAI API key.<br>';
      }
    }
  });

  async function handleRecognizedSpeech(apiKey, transcript) {
    output.innerHTML += 'Initial Transcript: ' + transcript + '<br>';
    let fullTranscript = transcript;
    let isIncomplete = await preprocessUserMessage(apiKey, transcript);
    console.log('isIncomplete:', isIncomplete);

    function handleNextTranscript(callback) {
      recognition.onresult = (event) => {
        const newTranscript = event.results[event.results.length - 1][0].transcript.trim();
        if (event.results[event.results.length - 1].isFinal) {
          callback(newTranscript);
        }
      };
    }

    while (isIncomplete) {
      const nextTranscript = await new Promise((resolve) => {
        handleNextTranscript((newTranscript) => {
          resolve(newTranscript);
        });
      });

      console.log('Next Transcript:', nextTranscript);
      fullTranscript += ' ' + nextTranscript;
      isIncomplete = await preprocessUserMessage(apiKey, fullTranscript);
      console.log('isIncomplete:', isIncomplete);
    }

    // Update conversationHistory outside the while loop
    conversationHistory.push({
      role: 'user',
      content: fullTranscript,
    });

    console.log('conversationHistory:', JSON.stringify(conversationHistory, null, 2));

    try {
      const assistantResponse = await getAssistantResponse(apiKey, conversationHistory);
      conversationHistory.push({
        role: 'assistant',
        content: assistantResponse,
      });

      // Display the full transcript instead of just the latest portion
      output.innerHTML += 'User: ' + fullTranscript + '<br>';
      output.innerHTML += 'Assistant: ' + assistantResponse + '<br>';
      if (speakText) {
        const utterance = new SpeechSynthesisUtterance(assistantResponse);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      output.innerHTML += 'Error: ' + error.message + '<br>';
    }
  }

  recognition.addEventListener('speechstart', () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
  });

  recognition.addEventListener('speechend', () => { });

  recognition.addEventListener('start', () => { });

  recognition.addEventListener('end', () => {
    startButton.disabled = false;
    stopButton.disabled = true;
  });

  recognition.addEventListener('soundstart', () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
  });

  recognition.addEventListener('soundend', () => { });

  recognition.addEventListener('audiostart', () => { });

  recognition.addEventListener('audioend', () => { });

  startButton.addEventListener("click", () => {
    recognition.start();
    startButton.disabled = true;
    stopButton.disabled = false;
  });

  stopButton.addEventListener("click", () => {
    recognition.stop();
    speechSynthesis.cancel();
    startButton.disabled = false;
    stopButton.disabled = true;
  });

  toggleSpeechButton.addEventListener("click", () => {
    speakText = !speakText;
    toggleSpeechButton.textContent = speakText ? "Disable Speech" : "Enable Speech";
  });
} else {
  startButton.disabled = true;
  stopButton.disabled = true;
  toggleSpeechButton.disabled = true;
  alert("Your browser does not support SpeechRecognition and SpeechSynthesis.");
}

async function getAssistantResponse(apiKey, messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: messages,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.choices[0].message.content;
  } else {
    throw new Error('Failed to get a response from the OpenAI API');
  }
}

function displayAndSpeakResponse(message) {
  output.innerHTML += "<strong>Assistant:</strong> " + message + "<br>";
  if (speakText) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.onstart = () => {
      userIsSpeaking = false;
    };
    utterance.onend = () => {
      userIsSpeaking = false;
    };
    if (!userIsSpeaking) {
      speechSynthesis.speak(utterance);
    } else {
      speechSynthesis.cancel();
    }
  }
}