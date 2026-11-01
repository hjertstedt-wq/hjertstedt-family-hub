export type ProviderId="icloud"|"google"|"ski"|"region5"|"svenskalag"|"sportsadmin";
export type ConnectionMode="existing"|"oauth"|"calendar_import"|"external";
export type ProviderDefinition={
 id:ProviderId;name:string;description:string;category:"Kalendrar"|"Idrott";
 mode:ConnectionMode;href:string;status:"available"|"partial"|"planned";
 explanation:string;icon:string;
};
export const providers:readonly ProviderDefinition[]=[
 {id:"icloud",name:"Apple Kalender",description:"Valfritt för familjer som använder iCloud",category:"Kalendrar",mode:"external",href:"/connections",status:"planned",explanation:"Varje familj ska få en egen privat anslutning. Ingen gemensam Apple-inloggning är aktiverad.",icon:""},
 {id:"google",name:"Google Kalender",description:"Se aktiviteter från Google",category:"Kalendrar",mode:"oauth",href:"/connections",status:"partial",explanation:"Google-anslutning finns i kalendern, men behöver verifieras innan allmän lansering.",icon:"G"},
 {id:"ski",name:"Svenska Skidförbundet",description:"Alpina tävlingar och kalenderimport",category:"Idrott",mode:"calendar_import",href:"/ski/import",status:"partial",explanation:"Import av kalenderfil finns. Automatisk officiell synkronisering är inte färdig.",icon:"⛷"},
 {id:"region5",name:"Region 5 – alpint",description:"Träningsläger och tävlingar",category:"Idrott",mode:"external",href:"/ski/sources",status:"planned",explanation:"Källor kan granskas, men automatiska aktivitetsflöden är inte anslutna.",icon:"🏔"},
 {id:"svenskalag",name:"Svenskalag",description:"Lagaktiviteter och kallelser",category:"Idrott",mode:"calendar_import",href:"/connections#sports",status:"partial",explanation:"Förhandsgranskning från prenumerationskalender finns. Automatisk synkronisering återstår.",icon:"⚽"},
 {id:"sportsadmin",name:"SportsAdmin",description:"Träningar, matcher och aktiviteter",category:"Idrott",mode:"calendar_import",href:"/connections#sports",status:"partial",explanation:"Förhandsgranskning från prenumerationskalender finns. Automatisk synkronisering återstår.",icon:"★"}
];
