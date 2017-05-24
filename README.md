# Hey Ada
This is the implementation of Hey Ada, a Facebook Messenger bot that helps people who are feeling stressed or depressed.  
Chat with Ada at https://m.me/heyada2017

How it works:
- When people first chat with Ada, they are given the choice to sign up as a supporter or as somebody who needs help.
- If the user indicates that they need help, Ada looks in its mongoDB collection of supporters and selectes a preconfigured number of available supporters to help the user. 
- Ada creates a new group (just a list of id numbers) and adds that new group to the group collection.
- All of the supporters in the group get notified that they have been entered into a group with somebody who needs help, and should message them.
- Whenever someone messages that group, Ada looks for the group which the sender belongs to, and sends everyone in that group the message. 

This project was an entry for the 2017 UWaterloo HeForShe Equithon. It's goal is to take the idea of mental health help lines, and migrate it to a more accessible platform: Facebook Messenger.  
Please contact me at rowan.dempster@gmail.com if you are intersted in helping me make this idea a reality. 

