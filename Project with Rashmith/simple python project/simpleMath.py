pip
import speech_recognition as sr
listner = sr.Recognizer()

try:
    with sr.Microphone() as source:
        print('Listening.....')
        voice = listener.listen(source)
        command = listner.recognize_google(voice)
        print(command)
except:
    pass


print("hi")
a=2
b=3
print(a+b)

import pip
pip install SpeechRecognition

pip install pandas