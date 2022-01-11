describe("smoke", () => {
  it("should work", () => {
    cy.visit("/");
    cy.contains("a", "15m Quickstart Blog Tutorial");
  });
});
