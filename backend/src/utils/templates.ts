import Handlebars from "handlebars";

export const renderTemplate = (tpl: string, data: Record<string, any>) =>
  Handlebars.compile(tpl)(data);

export const TPL_NEWSLETTER = `
  <h2>{{title}}</h2>
  <p>{{intro}}</p>
  {{#if listings}}
    <ul>
      {{#each listings}}
        <li><strong>{{this.title}}</strong> — {{this.location}} — KES {{this.price}}</li>
      {{/each}}
    </ul>
  {{/if}}
  <p>Regards,<br/>CribSpot Kenya</p>
`;