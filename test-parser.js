const { parseMessage } = require("./shared/parser");

const samples = [
`📌 Hire Available
⛳️  Pick -  Arugambay 
⚓️Drop - Galle (via Hiriketiye
📅 Date   - Today
⏰  Time - 10.00 AM
🚘Vehicle - KDH High 
 👩‍👩‍👧  Passengers - 09
💰 Price = 48000/=
     Contact = 0760726284`,

`🌴 Chrizt Ceylon Trails – Hire Available 🇱🇰
📅 Date: Today
⏰ Time: Now
🚖 Route: Galle to Negombo 
🚗 Vehicle Type: Sedan
👨‍✈️ Driver: Good English-speaking driver provided
📞 Contact: 0775553582`,

`👉Hire  Available 💎
‌Date>:)🌄 2026/08/ 25
‌Time  >:)  ⏰10.15 am
‌pick up locatio >:)🚀 arugamebe
‌Dro location>:)📌️ katunayaka
‌Amount >:)🏧 27000
‌Vehicle >:)🚔 any car
‌  Passengers>:)🙋‍♀️02`,

`🎯මැසේජ් එක හොදින් කියවා දුරකතන ඇමතුමක් ලබාදීමට කාරුණික වන්න ස්තුතියී🎯
     Tomorrow 
⏱️Time:  9.00am
🏩 pickup : pasikuda 
🏠 Drop :  wallawaya
 👩‍👩‍👧‍👦pax :  4
🚗Type: FR van                                 💸 pay:  32000
☎️0740433437`,

`Hire Available 
📅  Date  - 2026-08-25 Today 
🕕  Time -  now now
🚘 vehicle type - kdh van or aircon van
🙋 pick up - trincomalee 
🙋‍♂️ Drop - arugambay 
💁‍♀️ Amount-35000
Contact ☎️= 077 7194288`,

`⛖ TRANSFER AVAILABLE⛖ 
⛚  TODAY 10.45 𝗔𝗠
⛚  𝗡𝗜𝗟𝗔𝗪𝗘𝗟𝗜-  TO 𝗔𝗡𝗨𝗥𝗔𝗗𝗛𝗔𝗣𝗨𝗥𝗔
⛚  PRIUS  OR GOOD SEDAN 
 0760426992 - KANISHKA`,

`  Date   =  25/08/2026(Pending)
⌚️Time    =    Today
🚘 Vehicle Type  = SUV/KDH
📌 Pick  = Tangalle
 📍Drop  = BIA
🙎‍♂️Pax      = 02
📲Contact * 0713950082 (✅Only Whatsapp✅)`,

`Hire available 
Today at 11.45 pm
Welikanda to bia
06 passangers 
Need a kdh
Rs 33000`,

`☆ 𝐊𝐈𝐓𝐇𝐍𝐀𝐃𝐀 𝐓𝐎𝐔𝐑𝐒 ☆
   ✦ 𝑯𝒊𝒓𝒆  𝑨𝒗𝒂𝒊𝒍𝒂𝒃𝒍𝒆 ✦
𝐏𝐢𝐜𝐤      :colombo 
               U/D
𝐃𝐫𝐨𝐩     :bentota  
𝐃𝐚𝐭𝐞      :Today  
𝐓𝐢𝐦𝐞     :just now
𝐕𝐞𝐡𝐢𝐜𝐥𝐞 :kdh flat
              Rs25000`,

`Hire available 
Drop only
Pick up  : Arugam bay 
Drop off  : Colombo  
Vehicle    : Voxy, Noha, Glory, 7 seater vehicle or SUV
Pax            : 04
Time          : 9.45am
Date          : 25/08/2026
Contact     0758722745`,

`..🇱🇰 Hire available 
Pick up ÷ Arugambay 
Drop ÷ Ella 
Date: ÷ today 
Time ÷ 12.30pm
Vehicle ÷ sedan 
T.P.   : 076 0113884`,

`🚖  Hire Available 🚖
📆 Date         today   
⏰Time        11:30am
🚖 Picup          galle
🚖 Drop:       airport 
🚖Vehicle:  KDH/E25  F/R
🙋‍♂️🙋‍♀️ Pas:            05
☎️☎️ Phone       0779907333`,

`🏌️‍♂️🏌️‍♂️
🗓️   Date           ➡️ 27/08/2026
⏰ Time             ➡️ 10:30AM
🛫Pickup           ➡️ පිළියන්දල to up & down 
🛬Drop               ➡️  පොල්පිතිගම (කුරුණැගල)
🚕 Type              ➡️  KDH`,

`🌖FROM : moratuwa ( u / d )
🌖TO   :  anuradapura
🌖DATE  :  26
🌖VEHICLE  : non ac van
🌖AMOUNT:  
🌖PASSENGER :13 pax 
🌖COMMISION : 10%
🌖 Call : 0770608476`,

`Hire available TODAY 
✈️ From-ahangama
 TO     -airport 
Via negombo 
📅DATE-2026-08-25
⏰ TIME -1.45PM
🫂vehicle- sedan`,

`   🔥HIRE AVAILABLE🔥
⛳️ PICK UP : Kandy
🔚 DROP : Negombo
📅 DATE: 2026/08/25
⏱️ TIME  : 01.00PM
🛫 VEHICLE: Mini Van only
👫 PASSENGER : 04
💰 AMOUNT  : 12000/=
CONTACT NUMBER :0777214335`,

`Tomorrow morning 
8.30 Am 
Arugamby 
To 
Kitulgala
30000 
Only sedan car 🚘 
0789968791`,
];

samples.forEach((s, i) => {
  const result = parseMessage(s);
  console.log(`--- Sample ${i + 1} ---`);
  console.log(JSON.stringify({
    pickup: result.pickup,
    drop: result.drop,
    date: result.date,
    time: result.time,
    vehicle: result.vehicle,
    passengers: result.passengers,
    price: result.price,
    contact: result.contact,
  }));
});
